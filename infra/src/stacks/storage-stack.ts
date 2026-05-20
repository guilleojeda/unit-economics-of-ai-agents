import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { AppConfig } from "../config.js";
import { artifactBucketName } from "../names.js";

export type StorageStackProps = StackProps & {
  readonly config: AppConfig;
};

export class StorageStack extends Stack {
  public readonly artifactBucket: Bucket;

  public constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.artifactBucket = new Bucket(this, "ArtifactBucket", {
      bucketName: artifactBucketName(props.config),
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true
    });

    new CfnOutput(this, "ArtifactBucketName", {
      value: this.artifactBucket.bucketName
    });
  }
}
