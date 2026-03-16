import { AppError } from './errors.js';

export interface AppEnv {
  listenHost: string;
  listenPort: number;
  databaseUrl: string;
  adminToken: string;
  jwtSecret: string;
  redisUrl: string;
  minioEndpoint: string;
  minioPort: number;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
}

const DEFAULT_LISTEN_ADDR = '0.0.0.0:3001';

function parseListenAddr(listenAddr: string): { host: string; port: number } {
  const [host, portRaw] = listenAddr.split(':');
  const port = Number(portRaw);

  if (!host || Number.isNaN(port) || port <= 0) {
    throw new AppError(500, 'INVALID_CONFIG', 'LISTEN_ADDR must be host:port');
  }

  return { host, port };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AppError(500, 'MISSING_CONFIG', `Missing environment variable: ${name}`);
  }

  return value;
}

export function loadEnv(): AppEnv {
  const { host, port } = parseListenAddr(process.env.LISTEN_ADDR ?? DEFAULT_LISTEN_ADDR);

  return {
    listenHost: host,
    listenPort: port,
    databaseUrl: requireEnv('DATABASE_URL'),
    adminToken: requireEnv('ADMIN_TOKEN'),
    jwtSecret: requireEnv('JWT_SECRET'),
    redisUrl: requireEnv('REDIS_URL'),
    minioEndpoint: requireEnv('MINIO_ENDPOINT'),
    minioPort: Number(requireEnv('MINIO_PORT')),
    minioAccessKey: requireEnv('MINIO_ACCESS_KEY'),
    minioSecretKey: requireEnv('MINIO_SECRET_KEY'),
    minioBucket: requireEnv('MINIO_BUCKET'),
  };
}

export function getJwtSecret(): string {
  return requireEnv('JWT_SECRET');
}

export function getAdminToken(): string {
  return requireEnv('ADMIN_TOKEN');
}
