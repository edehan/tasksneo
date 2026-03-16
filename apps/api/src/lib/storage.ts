import { Client as MinioClient } from 'minio';
import { randomUUID } from 'node:crypto';

import { loadEnv } from './env.js';

let minio: MinioClient | null = null;
let bucketName: string | null = null;

function getClient() {
  if (minio && bucketName) {
    return { minio, bucket: bucketName };
  }

  const env = loadEnv();

  minio = new MinioClient({
    endPoint: env.minioEndpoint,
    port: env.minioPort,
    useSSL: false,
    accessKey: env.minioAccessKey,
    secretKey: env.minioSecretKey,
  });

  bucketName = env.minioBucket;

  return { minio, bucket: bucketName };
}

async function ensureBucketExists() {
  const { minio, bucket } = getClient();
  const exists = await minio.bucketExists(bucket).catch(() => false);

  if (!exists) {
    await minio.makeBucket(bucket);
  }
}

export async function uploadObject(parentType: string, parentId: string, fileName: string, bytes: Buffer, mimeType?: string) {
  const { minio, bucket } = getClient();
  await ensureBucketExists();

  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const objectKey = `${parentType}/${parentId}/${randomUUID()}${extension}`;

  await minio.putObject(bucket, objectKey, bytes, bytes.byteLength, mimeType ? { 'Content-Type': mimeType } : {});

  return objectKey;
}

export async function removeObject(fileKey: string) {
  const { minio, bucket } = getClient();
  await minio.removeObject(bucket, fileKey).catch(() => {
    // Ignore delete errors to keep DB cleanup resilient.
  });
}

export async function getPresignedUrl(fileKey: string, expirySeconds = 300): Promise<string> {
  const { minio, bucket } = getClient();
  await ensureBucketExists();
  return minio.presignedGetObject(bucket, fileKey, expirySeconds);
}
