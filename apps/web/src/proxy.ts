import { NextResponse } from 'next/server';

import { protectRequest } from '@/lib/request-security';

export function proxy(request: Request) {
  return protectRequest(request) ?? NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
