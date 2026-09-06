import { metricsText } from '@/lib/service-metrics';

export function GET(request: Request) {
  const configured = process.env.METRICS_TOKEN;
  if (
    !configured ||
    request.headers.get('authorization') !== `Bearer ${configured}`
  )
    return new Response(null, { status: 404 });
  return new Response(metricsText(), {
    headers: { 'content-type': 'text/plain; version=0.0.4' },
  });
}
