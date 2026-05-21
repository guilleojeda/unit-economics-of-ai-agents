import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  LambdaEdgeEventType,
  OriginProtocolPolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { experimental as cloudfrontExperimental } from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import type { IBucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { AwsCustomResource, AwsCustomResourcePolicy, Logging, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";
import type { HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import type { AppConfig } from "../config.js";
import { frontendBucketName } from "../names.js";

export type FrontendStackProps = StackProps & {
  readonly artifactBucket: Bucket;
  readonly config: AppConfig;
  readonly controlApi: HttpApi;
  readonly originProofSecret: Secret;
};

const browserAccessUsername = "agentcore-dev";
const cloudFrontOriginProofHeader = "x-cloudfront-origin-proof";

function edgeAuthCode(options: {
  readonly browserAccessSecretArn: string;
  readonly originProofSecretArn: string;
}): string {
  return `
'use strict';

const crypto = require('crypto');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const browserSecretArn = ${JSON.stringify(options.browserAccessSecretArn)};
const originProofSecretArn = ${JSON.stringify(options.originProofSecretArn)};
const originProofHeaderName = ${JSON.stringify(cloudFrontOriginProofHeader)};
const secrets = new SecretsManagerClient({ region: 'us-east-1' });
const cache = new Map();

function parseSecret(secretString) {
  try {
    const parsed = JSON.parse(secretString);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    return { token: secretString };
  }
  return { token: secretString };
}

async function getSecret(secretArn) {
  if (cache.has(secretArn)) {
    return cache.get(secretArn);
  }
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (typeof response.SecretString !== 'string' || response.SecretString.length === 0) {
    throw new Error('Required dev access secret is empty or unavailable');
  }
  const parsed = parseSecret(response.SecretString);
  cache.set(secretArn, parsed);
  return parsed;
}

function requestHeader(request, headerName) {
  const values = request.headers[headerName.toLowerCase()];
  if (!Array.isArray(values) || values.length !== 1) {
    return undefined;
  }
  return values[0].value;
}

function constantEquals(left, right) {
  const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
  const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest) && left === right;
}

function unauthorized() {
  return {
    status: '401',
    statusDescription: 'Unauthorized',
    headers: {
      'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic realm="AgentCore dev"' }],
      'cache-control': [{ key: 'Cache-Control', value: 'no-store' }],
      'content-type': [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }],
      'x-content-type-options': [{ key: 'X-Content-Type-Options', value: 'nosniff' }]
    },
    body: 'Authentication required'
  };
}

function stripSensitiveViewerHeaders(request) {
  delete request.headers.authorization;
  delete request.headers.cookie;
  delete request.headers['x-dev-access-token'];
  delete request.headers[originProofHeaderName];
}

function shouldRewriteToAppShell(uri) {
  if (uri.startsWith('/api/') || uri.startsWith('/_next/')) {
    return false;
  }
  if (uri === '/') {
    return true;
  }
  const lastSegment = uri.split('/').pop() || '';
  return !lastSegment.includes('.');
}

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const browserSecret = await getSecret(browserSecretArn);
  const username = browserSecret.username;
  const password = browserSecret.password;
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new Error('Browser access secret must contain username and password fields');
  }

  const authorization = requestHeader(request, 'authorization');
  const expected = 'Basic ' + Buffer.from(username + ':' + password, 'utf8').toString('base64');
  if (authorization === undefined || !constantEquals(authorization, expected)) {
    return unauthorized();
  }

  stripSensitiveViewerHeaders(request);
  if (request.uri.startsWith('/api/')) {
    const originProof = await getSecret(originProofSecretArn);
    const token = typeof originProof.token === 'string' ? originProof.token : undefined;
    if (token === undefined || token.length === 0) {
      throw new Error('Origin proof secret must contain a token string or raw secret string');
    }
    request.headers[originProofHeaderName] = [{ key: originProofHeaderName, value: token }];
  } else if (shouldRewriteToAppShell(request.uri)) {
    request.uri = '/index.html';
  }

  return request;
};
`;
}

function apiDomainName(scope: Construct, api: HttpApi): string {
  const stack = Stack.of(scope);
  return `${api.apiId}.execute-api.${stack.region}.${stack.urlSuffix}`;
}

export class FrontendStack extends Stack {
  public readonly frontendBucket: Bucket;
  public readonly distribution: Distribution;
  public readonly browserAccessSecret: Secret;

  public constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    this.frontendBucket = new Bucket(this, "FrontendBucket", {
      bucketName: frontendBucketName(props.config),
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true
    });

    this.browserAccessSecret = new Secret(this, "FrontendBrowserAccessSecret", {
      secretName: `${props.config.resourcePrefix}-frontend-browser-access`,
      description: "Dev-only browser Basic Auth credential for the CloudFront frontend.",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: browserAccessUsername }),
        generateStringKey: "password",
        passwordLength: 32,
        excludePunctuation: true
      }
    });

    const edgeAuthFunction = new cloudfrontExperimental.EdgeFunction(this, "FrontendViewerRequestAuth", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromInline(
        edgeAuthCode({
          browserAccessSecretArn: this.browserAccessSecret.secretArn,
          originProofSecretArn: props.originProofSecret.secretArn
        })
      ),
      memorySize: 128,
      timeout: Duration.seconds(5),
      logRetention: RetentionDays.ONE_WEEK
    });
    this.browserAccessSecret.grantRead(edgeAuthFunction);
    props.originProofSecret.grantRead(edgeAuthFunction);

    const responseHeadersPolicy = new ResponseHeadersPolicy(this, "FrontendResponseHeadersPolicy", {
      responseHeadersPolicyName: `${props.config.resourcePrefix}-frontend-security`,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: HeadersFrameOption.DENY,
          override: true
        },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.NO_REFERRER,
          override: true
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true
        }
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: "X-Robots-Tag", value: "noindex, nofollow", override: true },
          { header: "Cache-Control", value: "no-store", override: false }
        ]
      }
    });

    const apiOriginRequestPolicy = new OriginRequestPolicy(this, "FrontendApiOriginRequestPolicy", {
      originRequestPolicyName: `${props.config.resourcePrefix}-frontend-api-origin`,
      cookieBehavior: OriginRequestCookieBehavior.none(),
      headerBehavior: OriginRequestHeaderBehavior.allowList(
        "accept",
        "content-type",
        cloudFrontOriginProofHeader
      ),
      queryStringBehavior: OriginRequestQueryStringBehavior.all()
    });

    const webAcl = new CfnWebACL(this, "FrontendWebAcl", {
      name: `${props.config.resourcePrefix}-frontend`,
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.config.resourcePrefix}-frontend`,
        sampledRequestsEnabled: false
      },
      rules: [
        {
          name: "RateLimitPerIp",
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: "IP",
              limit: 2000
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${props.config.resourcePrefix}-frontend-rate-limit`,
            sampledRequestsEnabled: false
          }
        }
      ]
    });

    const edgeLambdas = [
      {
        eventType: LambdaEdgeEventType.VIEWER_REQUEST,
        functionVersion: edgeAuthFunction.currentVersion
      }
    ];

    this.distribution = new Distribution(this, "FrontendDistribution", {
      comment: `${props.config.resourcePrefix} protected dev frontend`,
      defaultRootObject: "index.html",
      enableLogging: false,
      webAclId: webAcl.attrArn,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.frontendBucket as unknown as IBucket),
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.USE_ORIGIN_CACHE_CONTROL_HEADERS,
        compress: true,
        edgeLambdas,
        responseHeadersPolicy,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new HttpOrigin(apiDomainName(this, props.controlApi), {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
            readTimeout: Duration.seconds(30)
          }),
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          compress: false,
          edgeLambdas,
          originRequestPolicy: apiOriginRequestPolicy,
          responseHeadersPolicy,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        }
      }
    });

    const frontendOrigin = `https://${this.distribution.distributionDomainName}`;
    new AwsCustomResource(this, "ArtifactBucketBrowserUploadCors", {
      onCreate: {
        service: "S3",
        action: "putBucketCors",
        parameters: {
          Bucket: props.artifactBucket.bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ["content-type"],
                AllowedMethods: ["PUT"],
                AllowedOrigins: [frontendOrigin],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 300
              }
            ]
          }
        },
        physicalResourceId: PhysicalResourceId.of(
          `${props.config.resourcePrefix}-artifact-cors-for-frontend`
        ),
        logging: Logging.withDataHidden()
      },
      onUpdate: {
        service: "S3",
        action: "putBucketCors",
        parameters: {
          Bucket: props.artifactBucket.bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ["content-type"],
                AllowedMethods: ["PUT"],
                AllowedOrigins: [frontendOrigin],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 300
              }
            ]
          }
        },
        physicalResourceId: PhysicalResourceId.of(
          `${props.config.resourcePrefix}-artifact-cors-for-frontend`
        ),
        logging: Logging.withDataHidden()
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["s3:PutBucketCORS"],
          resources: [props.artifactBucket.bucketArn]
        })
      ]),
      installLatestAwsSdk: false,
      logRetention: RetentionDays.ONE_WEEK
    });

    new CfnOutput(this, "FrontendUrl", {
      value: frontendOrigin
    });

    new CfnOutput(this, "FrontendDistributionId", {
      value: this.distribution.distributionId
    });

    new CfnOutput(this, "FrontendDistributionDomainName", {
      value: this.distribution.distributionDomainName
    });

    new CfnOutput(this, "FrontendBucketName", {
      value: this.frontendBucket.bucketName
    });

    new CfnOutput(this, "FrontendBrowserAccessSecretArn", {
      value: this.browserAccessSecret.secretArn
    });

    new CfnOutput(this, "FrontendOriginProofSecretArn", {
      value: props.originProofSecret.secretArn
    });

    new CfnOutput(this, "FrontendAccessMode", {
      value: "CLOUDFRONT_BASIC_AUTH_AND_ORIGIN_PROOF"
    });

    new CfnOutput(this, "FrontendApiBasePath", {
      value: "/api"
    });

    new CfnOutput(this, "FrontendHostingMode", {
      value: "S3_CLOUDFRONT_STATIC_EXPORT"
    });
  }
}
