export const USAGE_THRESHOLDS = {
  observe: 50,
  watch: 70,
  attention: 85,
  critical: 95,
} as const;

export type UsageLevel = "normal" | "observe" | "watch" | "attention" | "critical";

export type UsageSnapshot = {
  capturedAt: string;
  periodStart: string;
  periodEnd: string;
  cachedEgressBytes: number;
  uncachedEgressBytes: number;
  cachedEgressLimitBytes: number;
  uncachedEgressLimitBytes: number;
  apiRequests?: number;
};

export type UsageMetric = {
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
  level: UsageLevel;
  projectedBytes: number | null;
  projectedPercent: number | null;
  projectedLevel: UsageLevel | null;
};

export type UsageReport = {
  capturedAt: string;
  periodStart: string;
  periodEnd: string;
  elapsedPercent: number;
  apiRequests: number | null;
  cachedEgress: UsageMetric;
  uncachedEgress: UsageMetric;
  highestLevel: UsageLevel;
};

function finiteNonNegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be a non-negative number.`);
  return value;
}

function levelForPercent(percent: number): UsageLevel {
  if (percent >= USAGE_THRESHOLDS.critical) return "critical";
  if (percent >= USAGE_THRESHOLDS.attention) return "attention";
  if (percent >= USAGE_THRESHOLDS.watch) return "watch";
  if (percent >= USAGE_THRESHOLDS.observe) return "observe";
  return "normal";
}

function levelRank(level: UsageLevel) {
  return ["normal", "observe", "watch", "attention", "critical"].indexOf(level);
}

function metric(usedBytes: number, limitBytes: number, elapsedPercent: number): UsageMetric {
  const usedPercent = (usedBytes / limitBytes) * 100;
  const projectedBytes = elapsedPercent > 0 ? usedBytes / (elapsedPercent / 100) : null;
  const projectedPercent = projectedBytes === null ? null : (projectedBytes / limitBytes) * 100;
  return {
    usedBytes,
    limitBytes,
    usedPercent,
    level: levelForPercent(usedPercent),
    projectedBytes,
    projectedPercent,
    projectedLevel: projectedPercent === null ? null : levelForPercent(projectedPercent),
  };
}

export function createUsageReport(snapshot: UsageSnapshot, now = Date.now()): UsageReport {
  const start = Date.parse(snapshot.periodStart);
  const end = Date.parse(snapshot.periodEnd);
  const captured = Date.parse(snapshot.capturedAt);
  if (![start, end, captured].every(Number.isFinite) || end <= start) {
    throw new Error("Usage period and capture timestamps must be valid and ordered.");
  }

  const elapsedPercent = Math.min(
    100,
    Math.max(0, ((Math.min(now, end) - start) / (end - start)) * 100),
  );
  const cachedEgressBytes = finiteNonNegative(snapshot.cachedEgressBytes, "cachedEgressBytes");
  const uncachedEgressBytes = finiteNonNegative(
    snapshot.uncachedEgressBytes,
    "uncachedEgressBytes",
  );
  const cachedEgressLimitBytes = finiteNonNegative(
    snapshot.cachedEgressLimitBytes,
    "cachedEgressLimitBytes",
  );
  const uncachedEgressLimitBytes = finiteNonNegative(
    snapshot.uncachedEgressLimitBytes,
    "uncachedEgressLimitBytes",
  );
  if (cachedEgressLimitBytes <= 0 || uncachedEgressLimitBytes <= 0) {
    throw new Error("Egress limits must be greater than zero.");
  }

  const cachedEgress = metric(cachedEgressBytes, cachedEgressLimitBytes, elapsedPercent);
  const uncachedEgress = metric(uncachedEgressBytes, uncachedEgressLimitBytes, elapsedPercent);
  const levels = [cachedEgress.level, uncachedEgress.level];
  return {
    capturedAt: snapshot.capturedAt,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    elapsedPercent,
    apiRequests:
      snapshot.apiRequests == null ? null : finiteNonNegative(snapshot.apiRequests, "apiRequests"),
    cachedEgress,
    uncachedEgress,
    highestLevel: levels.reduce(
      (highest, level) => (levelRank(level) > levelRank(highest) ? level : highest),
      "normal",
    ),
  };
}
