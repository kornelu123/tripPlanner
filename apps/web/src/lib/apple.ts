import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { readAuthEnvironment } from '@trip-planner/config';

const appleKeys = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

export async function appleClientSecret() {
  const env = readAuthEnvironment();
  if (
    !env.APPLE_CLIENT_ID ||
    !env.APPLE_TEAM_ID ||
    !env.APPLE_KEY_ID ||
    !env.APPLE_PRIVATE_KEY
  )
    throw new Error('Apple login is not configured.');
  const key = await importPKCS8(
    env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    'ES256',
  );
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID })
    .setIssuer(env.APPLE_TEAM_ID)
    .setAudience('https://appleid.apple.com')
    .setSubject(env.APPLE_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

export async function verifyAppleIdentityToken(token: string) {
  const clientId = readAuthEnvironment().APPLE_CLIENT_ID;
  if (!clientId) throw new Error('Apple login is not configured.');
  const { payload } = await jwtVerify(token, appleKeys, {
    issuer: 'https://appleid.apple.com',
    audience: clientId,
  });
  if (
    !payload.sub ||
    typeof payload.email !== 'string' ||
    (payload.email_verified !== true && payload.email_verified !== 'true')
  )
    throw new Error('Unverified Apple identity.');
  return { subject: payload.sub, email: payload.email };
}
