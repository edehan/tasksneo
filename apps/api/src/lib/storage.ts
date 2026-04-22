import { randomUUID } from "node:crypto";
import type { BucketItemStat } from "minio";
import { Client as MinioClient } from "minio";

import { loadEnv } from "./env.js";

let minio: MinioClient | null = null;
let bucketName: string | null = null;
let bucketVerified = false;

function getClient() {
	if (minio && bucketName) {
		return { minio, bucket: bucketName };
	}

	const env = loadEnv();

	minio = new MinioClient({
		endPoint: env.s3Endpoint,
		...(env.s3Port != null && { port: env.s3Port }),
		useSSL: env.s3UseSSL,
		accessKey: env.s3AccessKey,
		secretKey: env.s3SecretKey,
		region: env.s3Region,
		pathStyle: env.s3PathStyle,
	});

	bucketName = env.s3Bucket;

	return { minio, bucket: bucketName };
}

async function ensureBucketExists() {
	if (bucketVerified) return;

	const { minio, bucket } = getClient();

	try {
		const exists = await minio.bucketExists(bucket);

		if (!exists) {
			try {
				await minio.makeBucket(bucket);
			} catch (createErr) {
				// External S3 providers may deny CreateBucket permission.
				// If the bucket doesn't exist and we can't create it, log a warning.
				console.warn(
					`[storage] Could not create bucket "${bucket}":`,
					createErr,
				);
				return;
			}
		}

		bucketVerified = true;
	} catch {
		// bucketExists failed — connectivity issue. Don't cache; will retry next call.
	}
}

function getSafeExtension(fileName: string) {
	const baseName = fileName.split(/[\\/]/).pop() ?? fileName;
	const dotIndex = baseName.lastIndexOf(".");

	if (dotIndex <= 0) {
		return "";
	}

	const extension = baseName.slice(dotIndex);
	return /^\.[A-Za-z0-9]{1,16}$/.test(extension) ? extension : "";
}

export function createTaskAttachmentObjectKey(
	taskId: string,
	fileName: string,
) {
	return `tasks/${taskId}/${randomUUID()}${getSafeExtension(fileName)}`;
}

export function createSubmissionAttachmentObjectKey(
	taskId: string,
	userId: string,
	fileName: string,
) {
	return `submissions/${taskId}/${userId}/${randomUUID()}${getSafeExtension(
		fileName,
	)}`;
}

export async function getPresignedPutUrl(
	fileKey: string,
	expirySeconds = 300,
): Promise<string> {
	const { minio, bucket } = getClient();
	await ensureBucketExists();
	return minio.presignedPutObject(bucket, fileKey, expirySeconds);
}

export async function statObject(
	fileKey: string,
): Promise<BucketItemStat | null> {
	const { minio, bucket } = getClient();

	try {
		return await minio.statObject(bucket, fileKey);
	} catch {
		return null;
	}
}

export async function removeObject(fileKey: string) {
	const { minio, bucket } = getClient();
	await minio.removeObject(bucket, fileKey).catch(() => {
		// Ignore delete errors to keep DB cleanup resilient.
	});
}

export async function getObjectBuffer(fileKey: string): Promise<Buffer | null> {
	const { minio, bucket } = getClient();

	try {
		const stream = await minio.getObject(bucket, fileKey);
		const chunks: Buffer[] = [];

		for await (const chunk of stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}

		return Buffer.concat(chunks);
	} catch {
		return null;
	}
}

export async function getPresignedUrl(
	fileKey: string,
	expirySeconds = 300,
): Promise<string> {
	const { minio, bucket } = getClient();
	await ensureBucketExists();
	return minio.presignedGetObject(bucket, fileKey, expirySeconds);
}

export async function getTaskAttachmentPresignedUrl(
	fileKey: string,
): Promise<string> {
	const { minio, bucket } = getClient();
	await ensureBucketExists();
	return minio.presignedGetObject(bucket, fileKey, 86400); // 1440 minutes = 24 hours
}

export async function getStorageStatus(): Promise<{
	endpoint: string;
	bucket: string;
	useSSL: boolean;
	region: string;
	connected: boolean;
	error?: string;
}> {
	const env = loadEnv();

	try {
		const { minio, bucket } = getClient();
		const exists = await minio.bucketExists(bucket);

		return {
			endpoint: env.s3Endpoint,
			bucket,
			useSSL: env.s3UseSSL,
			region: env.s3Region,
			connected: exists,
			...(!exists && { error: `Bucket "${bucket}" not found` }),
		};
	} catch (err) {
		return {
			endpoint: env.s3Endpoint,
			bucket: env.s3Bucket,
			useSSL: env.s3UseSSL,
			region: env.s3Region,
			connected: false,
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}
