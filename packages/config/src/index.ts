import { z } from 'zod';

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().startsWith('postgresql://'),
  REDIS_URL: z.url().startsWith('redis://'),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function readServerEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

const authEnvironmentSchema = z.object({
  APP_URL: z.url(),
  WEBAUTHN_RP_ID: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  APPLE_PRIVATE_KEY: z.string().min(1).optional(),
  SMTP_URL: z.url().optional(),
  EMAIL_FROM: z.email().optional(),
});

export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

export function readAuthEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AuthEnvironment {
  if (environment.NODE_ENV === 'production' && !environment.APP_URL) {
    throw new Error('APP_URL is required in production.');
  }
  const appUrl = environment.APP_URL ?? 'http://localhost:3000';
  const parsed = authEnvironmentSchema.parse({
    ...environment,
    APP_URL: appUrl,
    WEBAUTHN_RP_ID: environment.WEBAUTHN_RP_ID ?? new URL(appUrl).hostname,
  });
  if (
    environment.NODE_ENV === 'production' &&
    parsed.WEBAUTHN_RP_ID !== new URL(parsed.APP_URL).hostname
  ) {
    throw new Error(
      'WEBAUTHN_RP_ID must match the production APP_URL hostname.',
    );
  }
  return parsed;
}
