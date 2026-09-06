import { NextResponse } from 'next/server';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const windows = new Map<string, { count: number; resetAt: number }>();

export const maximumRequestBytes = 64 * 1024;
export const rateLimitPerMinute = 120;

export function protectRequest(request: Request): NextResponse | undefined {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maximumRequestBytes)
    return NextResponse.json(
      { message: 'Request body too large.' },
      { status: 413 },
    );

  const address =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const key = `${address}:${new URL(request.url).pathname}`;
  const now = Date.now();
  const window = windows.get(key);
  const current =
    !window || window.resetAt <= now
      ? { count: 1, resetAt: now + 60_000 }
      : { ...window, count: window.count + 1 };
  windows.set(key, current);
  if (current.count > rateLimitPerMinute)
    return NextResponse.json(
      { message: 'Too many requests.' },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.ceil((current.resetAt - now) / 1000)),
        },
      },
    );

  if (
    mutationMethods.has(request.method) &&
    request.headers.get('cookie')?.includes('__Host-roamly_session=')
  ) {
    const origin = request.headers.get('origin');
    const expected = new URL(request.url).origin;
    if (
      origin !== expected ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return NextResponse.json(
        { message: 'CSRF validation failed.' },
        { status: 403 },
      );
  }
}

export function resetRequestSecurityForTests() {
  windows.clear();
}
