import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { RepositoryConfigError, RepositorySerializationError } from "./errors.js";

export type ArtifactKeyContext = {
  readonly workspaceId?: string;
  readonly documentId?: string;
  readonly jobId?: string;
  readonly runId?: string;
};

export type PutArtifactObjectOptions = {
  readonly key: string;
  readonly body: string | Uint8Array;
  readonly contentType: string;
  readonly context?: ArtifactKeyContext;
};

export type GetArtifactObjectOptions = {
  readonly key: string;
  readonly versionId?: string;
  readonly context?: ArtifactKeyContext;
};

export type PresignPutOptions = {
  readonly key: string;
  readonly contentType: string;
  readonly expiresInSeconds: number;
  readonly context?: ArtifactKeyContext;
};

export type PresignGetOptions = {
  readonly key: string;
  readonly versionId?: string;
  readonly expiresInSeconds: number;
  readonly context?: ArtifactKeyContext;
};

export type ArtifactObjectMetadata = {
  readonly contentType?: string;
  readonly contentLength?: number;
  readonly eTag?: string;
  readonly versionId?: string;
};

export type PutArtifactJsonOptions<T> = Omit<PutArtifactObjectOptions, "body"> & {
  readonly value: T;
};

export type ArtifactObjectStore = {
  putObject(options: PutArtifactObjectOptions): Promise<void>;
  getObjectMetadata(options: GetArtifactObjectOptions): Promise<ArtifactObjectMetadata>;
  getObjectBytes(options: GetArtifactObjectOptions): Promise<Uint8Array>;
  putJson<T>(options: PutArtifactJsonOptions<T>): Promise<void>;
  getJson<T>(options: GetArtifactObjectOptions & { readonly parse: (value: unknown) => T }): Promise<T>;
  createPresignedPutUrl(options: PresignPutOptions): Promise<string>;
  createPresignedGetUrl(options: PresignGetOptions): Promise<string>;
};

export type S3Command = PutObjectCommand | GetObjectCommand | HeadObjectCommand;

export type S3Sender = {
  send(command: S3Command): Promise<unknown>;
};

export type PresignUrl = (command: S3Command, expiresInSeconds: number) => Promise<string>;

const maxPresignExpirationSeconds = 900;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateContentType(contentType: string): void {
  if (contentType.length === 0) {
    throw new RepositoryConfigError("Artifact object content type is required");
  }
}

function validatePresignExpiration(expiresInSeconds: number): void {
  if (
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds > maxPresignExpirationSeconds
  ) {
    throw new RepositoryConfigError("Presigned artifact URL expiration must be 1-900 seconds");
  }
}

export function validateArtifactS3Key(key: string, context: ArtifactKeyContext = {}): void {
  if (
    key.length === 0 ||
    key.startsWith("/") ||
    key.startsWith("s3://") ||
    !key.startsWith("workspaces/")
  ) {
    throw new RepositoryConfigError(`Invalid artifact S3 key: ${key}`);
  }

  const segments = key.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new RepositoryConfigError(`Invalid artifact S3 key path segments: ${key}`);
  }

  const [workspacesSegment, workspaceId] = segments;
  if (workspacesSegment !== "workspaces" || workspaceId === undefined || segments.length < 4) {
    throw new RepositoryConfigError(`Artifact S3 key must start with a workspace segment: ${key}`);
  }

  if (context.workspaceId !== undefined && workspaceId !== context.workspaceId) {
    throw new RepositoryConfigError("Artifact S3 key workspace does not match the expected context");
  }

  const documentsIndex = segments.indexOf("documents");
  if (context.documentId !== undefined && documentsIndex >= 0) {
    if (segments[documentsIndex + 1] !== context.documentId) {
      throw new RepositoryConfigError("Artifact S3 key document does not match the expected context");
    }
  }

  const jobsIndex = segments.indexOf("jobs");
  if (context.jobId !== undefined) {
    if (jobsIndex < 0 || segments[jobsIndex + 1] !== context.jobId) {
      throw new RepositoryConfigError("Artifact S3 key job does not match the expected context");
    }
  }

  const runsIndex = segments.indexOf("runs");
  if (context.runId !== undefined) {
    if (runsIndex < 0 || segments[runsIndex + 1] !== context.runId) {
      throw new RepositoryConfigError("Artifact S3 key run does not match the expected context");
    }
  }
}

async function readReadableStream(stream: Readable): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(new TextEncoder().encode(chunk));
    } else if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
    } else {
      throw new RepositorySerializationError("Unsupported S3 stream chunk type");
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

async function bodyToBytes(body: unknown): Promise<Uint8Array> {
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (body instanceof Readable) {
    return readReadableStream(body);
  }

  throw new RepositorySerializationError("Unsupported or missing S3 object body");
}

function responseBody(response: unknown): unknown {
  if (!isRecord(response) || response.Body === undefined) {
    throw new RepositorySerializationError("S3 get response did not include a body");
  }

  return response.Body;
}

export function createS3ClientSender(region: "us-east-1"): S3Sender {
  const client = new S3Client({ region });
  return {
    async send(command: S3Command): Promise<unknown> {
      return client.send(command);
    }
  };
}

export function createS3ClientPresigner(region: "us-east-1"): PresignUrl {
  const client = new S3Client({ region });
  return async (command, expiresInSeconds) => getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export class S3ArtifactObjectStore implements ArtifactObjectStore {
  public constructor(
    private readonly client: S3Sender,
    private readonly bucketName: string,
    private readonly presignUrl: PresignUrl
  ) {
    if (bucketName.length === 0) {
      throw new RepositoryConfigError("Artifact object store requires an S3 bucket name");
    }
  }

  public async putObject(options: PutArtifactObjectOptions): Promise<void> {
    validateArtifactS3Key(options.key, options.context);
    validateContentType(options.contentType);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType
      })
    );
  }

  public async getObjectBytes(options: GetArtifactObjectOptions): Promise<Uint8Array> {
    validateArtifactS3Key(options.key, options.context);
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        ...(options.versionId === undefined ? {} : { VersionId: options.versionId })
      })
    );
    return bodyToBytes(responseBody(response));
  }

  public async getObjectMetadata(options: GetArtifactObjectOptions): Promise<ArtifactObjectMetadata> {
    validateArtifactS3Key(options.key, options.context);
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        ...(options.versionId === undefined ? {} : { VersionId: options.versionId })
      })
    );

    if (!isRecord(response)) {
      throw new RepositorySerializationError("S3 head response is not an object");
    }

    return {
      ...(typeof response.ContentType === "string" ? { contentType: response.ContentType } : {}),
      ...(typeof response.ContentLength === "number" ? { contentLength: response.ContentLength } : {}),
      ...(typeof response.ETag === "string" ? { eTag: response.ETag } : {}),
      ...(typeof response.VersionId === "string" ? { versionId: response.VersionId } : {})
    };
  }

  public async putJson<T>(options: PutArtifactJsonOptions<T>): Promise<void> {
    await this.putObject({
      key: options.key,
      body: JSON.stringify(options.value),
      contentType: options.contentType,
      ...(options.context === undefined ? {} : { context: options.context })
    });
  }

  public async getJson<T>(
    options: GetArtifactObjectOptions & { readonly parse: (value: unknown) => T }
  ): Promise<T> {
    const bytes = await this.getObjectBytes(options);
    const text = new TextDecoder().decode(bytes);

    try {
      return options.parse(JSON.parse(text));
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new RepositorySerializationError("S3 object did not contain valid JSON");
      }

      throw error;
    }
  }

  public async createPresignedPutUrl(options: PresignPutOptions): Promise<string> {
    validateArtifactS3Key(options.key, options.context);
    validateContentType(options.contentType);
    validatePresignExpiration(options.expiresInSeconds);
    return this.presignUrl(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        ContentType: options.contentType
      }),
      options.expiresInSeconds
    );
  }

  public async createPresignedGetUrl(options: PresignGetOptions): Promise<string> {
    validateArtifactS3Key(options.key, options.context);
    validatePresignExpiration(options.expiresInSeconds);
    return this.presignUrl(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        ...(options.versionId === undefined ? {} : { VersionId: options.versionId })
      }),
      options.expiresInSeconds
    );
  }
}
