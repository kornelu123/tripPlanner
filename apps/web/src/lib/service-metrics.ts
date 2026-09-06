const counters = new Map<string, number>();
const observations = new Map<string, { count: number; total: number }>();

export function incrementMetric(name: string) {
  counters.set(name, (counters.get(name) ?? 0) + 1);
}
export function observeMetric(name: string, value: number) {
  const metric = observations.get(name) ?? { count: 0, total: 0 };
  observations.set(name, {
    count: metric.count + 1,
    total: metric.total + value,
  });
}
export function metricsText() {
  return (
    [
      ...[...counters].map(([name, value]) => `${name} ${value}`),
      ...[...observations].flatMap(([name, value]) => [
        `${name}_count ${value.count}`,
        `${name}_sum ${value.total}`,
      ]),
    ].join('\n') + '\n'
  );
}
