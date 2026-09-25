import { isAbsolute, join } from 'node:path';
import { z } from 'zod';

const absolutePath = z.string().min(1).refine(isAbsolute);
const environmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('production'),
  APP_HOST: z.string().trim().min(1).default('127.0.0.1'),
  APP_PORT: z
    .string()
    .regex(/^[0-9]+$/)
    .refine((value) => Number(value) >= 1 && Number(value) <= 65535)
    .default('3000'),
  APP_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_PBX_NETWORK_MODE: z.enum(['disabled', 'plain_tcp']).default('disabled'),
  DATA_PATH: absolutePath.default('/data'),
  APP_SECRET_DIR: absolutePath.optional(),
  APP_DATABASE_PATH: absolutePath.optional(),
});

export interface AppConfig {
  environment: 'development' | 'test' | 'production';
  http: { host: string; port: number };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  pbxNetworkMode: 'disabled' | 'plain_tcp';
  dataDirectory: string;
  secretDirectory: string;
  databasePath: string;
}

export class ConfigError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Invalid application configuration: ${fields.join(', ')}`);
    this.name = 'ConfigError';
    this.fields = fields;
  }
}

/** The schema reads only named application settings; no raw environment is logged. */
export function loadAppConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new ConfigError(fields);
  }

  const values = result.data;
  return {
    environment: values.APP_ENV,
    http: { host: values.APP_HOST, port: Number(values.APP_PORT) },
    logLevel: values.APP_LOG_LEVEL,
    pbxNetworkMode: values.APP_PBX_NETWORK_MODE,
    dataDirectory: values.DATA_PATH,
    secretDirectory: values.APP_SECRET_DIR ?? join(values.DATA_PATH, 'secrets'),
    databasePath: values.APP_DATABASE_PATH ?? join(values.DATA_PATH, 'monitor.sqlite3'),
  };
}
