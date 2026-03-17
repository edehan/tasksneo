import { prisma } from '@taskflow/db';

import { AppError } from '../lib/errors.js';
import { decryptConfigValue, encryptConfigValue, isSecretConfigKey } from '../lib/system-config.js';

const DEFAULT_CONFIG: Record<string, string> = {
  'app.title': 'TaskFlow',
  'app.base_url': 'http://localhost:3000',
  'auth.registration_open': 'true',
  'notif.before_due_hours': '24,2',
};

const ALLOWED_CONFIG_KEYS = new Set([
  'app.title',
  'app.base_url',
  'auth.registration_open',
  'notif.before_due_hours',
  'smtp.host',
  'smtp.port',
  'smtp.user',
  'smtp.password',
  'smtp.from',
  'llm.provider',
  'llm.base_url',
  'llm.api_key',
  'llm.model',
]);

function decodeSecretForAdminView(value: string) {
  try {
    decryptConfigValue(value);
    return '***';
  } catch {
    return '[re-enter value]';
  }
}

export async function getConfigMap() {
  const rows = await prisma.systemConfig.findMany();
  const map = new Map<string, string>();

  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    map.set(key, value);
  }

  for (const row of rows) {
    map.set(row.key, isSecretConfigKey(row.key) ? decodeSecretForAdminView(row.value) : row.value);
  }

  return map;
}

export async function getConfigValue(key: string): Promise<string | null> {
  if (!ALLOWED_CONFIG_KEYS.has(key) && !(key in DEFAULT_CONFIG)) {
    return null;
  }

  const row = await prisma.systemConfig.findUnique({ where: { key } });

  if (!row) {
    return DEFAULT_CONFIG[key] ?? null;
  }

  return isSecretConfigKey(key) ? decryptConfigValue(row.value) : row.value;
}

export async function assertRegistrationOpen() {
  const value = await getConfigValue('auth.registration_open');

  if (value?.toLowerCase() === 'false') {
    throw new AppError(403, 'REGISTRATION_CLOSED', 'Registration is closed');
  }
}

export async function updateConfig(entries: Record<string, string>) {
  const keys = Object.keys(entries);

  for (const key of keys) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      throw new AppError(400, 'INVALID_CONFIG_KEY', `Unsupported config key: ${key}`);
    }
  }

  await prisma.$transaction(
    keys.map((key) =>
      prisma.systemConfig.upsert({
        where: { key },
        update: {
          value: isSecretConfigKey(key) ? encryptConfigValue(entries[key]) : entries[key],
        },
        create: {
          key,
          value: isSecretConfigKey(key) ? encryptConfigValue(entries[key]) : entries[key],
        },
      }),
    ),
  );

  return getConfigMap();
}
