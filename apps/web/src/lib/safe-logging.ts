const sensitiveKeys =
  /authorization|cookie|token|secret|password|metadata|latitude|longitude|coordinates|sourceurl/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeys.test(key) ? '[REDACTED]' : redact(item),
      ]),
    );
  return value;
}

export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const safeContext = redact(context) as Record<string, unknown>;
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'request_failure',
      error: error instanceof Error ? error.name : 'UnknownError',
      ...safeContext,
    }),
  );
}

export function auditEvent(
  event: string,
  actorId?: string,
  subjectId?: string,
) {
  console.info(
    JSON.stringify({
      level: 'info',
      event: 'security_audit',
      action: event,
      actorId,
      subjectId,
      occurredAt: new Date().toISOString(),
    }),
  );
}
