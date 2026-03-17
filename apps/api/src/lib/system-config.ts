import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { AppError } from './errors.js';
import { getSystemConfigSecret } from './env.js';

const ENCRYPTED_PREFIX = 'enc:v1';
const CIPHER_ALGORITHM = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(getSystemConfigSecret()).digest();
}

export function encryptConfigValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptConfigValue(value: string): string {
  if (!value.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    return value;
  }

  const payload = value.slice(`${ENCRYPTED_PREFIX}:`.length);
  const parts = payload.split(':');

  if (parts.length !== 3) {
    throw new AppError(500, 'CONFIG_DECRYPT_FAILED', 'Encrypted system config payload is malformed');
  }

  const [ivRaw, tagRaw, dataRaw] = parts;
  const iv = Buffer.from(ivRaw, 'base64');
  const tag = Buffer.from(tagRaw, 'base64');
  const data = Buffer.from(dataRaw, 'base64');

  try {
    const decipher = createDecipheriv(CIPHER_ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new AppError(
      500,
      'CONFIG_DECRYPT_FAILED',
      'Encrypted system config could not be decrypted with the current system config secret',
    );
  }
}

export const SECRET_CONFIG_KEYS = new Set(['smtp.user', 'smtp.password', 'llm.api_key']);

export function isSecretConfigKey(key: string): boolean {
  return SECRET_CONFIG_KEYS.has(key);
}
