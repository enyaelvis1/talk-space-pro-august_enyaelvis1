export type RequestSample = {
  url: string;
  status: number;
  bytes?: number;
};

export type RequestBucket = {
  requests: number;
  responses: number;
  failedResponses: number;
  bytes: number;
};

export type RequestBudgetReport = {
  total: RequestBucket;
  byCategory: Record<RequestCategory, RequestBucket>;
};

export type RequestCategory =
  "auth" | "database" | "storage" | "realtime" | "serverFunction" | "other";

export type RequestBudget = Partial<
  Record<RequestCategory, { maxRequests?: number; maxBytes?: number }>
>;

function emptyBucket(): RequestBucket {
  return { requests: 0, responses: 0, failedResponses: 0, bytes: 0 };
}

function addSample(bucket: RequestBucket, sample: RequestSample) {
  bucket.requests++;
  if (sample.status > 0) {
    bucket.responses++;
    if (sample.status >= 400) bucket.failedResponses++;
  }
  if (Number.isFinite(sample.bytes) && (sample.bytes ?? 0) > 0) bucket.bytes += sample.bytes!;
}

export function classifyRequest(url: string): RequestCategory {
  const path = new URL(url).pathname;
  if (path.startsWith("/auth/")) return "auth";
  if (path.startsWith("/rest/v1/")) return "database";
  if (path.startsWith("/storage/v1/")) return "storage";
  if (path.startsWith("/realtime/")) return "realtime";
  if (path.startsWith("/_serverFn/")) return "serverFunction";
  return "other";
}

export function createRequestBudgetReport(samples: RequestSample[]): RequestBudgetReport {
  const categories: RequestCategory[] = [
    "auth",
    "database",
    "storage",
    "realtime",
    "serverFunction",
    "other",
  ];
  const byCategory = Object.fromEntries(
    categories.map((category) => [category, emptyBucket()]),
  ) as Record<RequestCategory, RequestBucket>;
  const total = emptyBucket();

  for (const sample of samples) {
    addSample(total, sample);
    addSample(byCategory[classifyRequest(sample.url)], sample);
  }

  return { total, byCategory };
}

export function findRequestBudgetViolations(report: RequestBudgetReport, budget: RequestBudget) {
  const violations: string[] = [];
  for (const [category, limits] of Object.entries(budget) as [
    RequestCategory,
    NonNullable<RequestBudget[RequestCategory]>,
  ][]) {
    const bucket = report.byCategory[category];
    if (limits.maxRequests !== undefined && bucket.requests > limits.maxRequests) {
      violations.push(`${category} requests ${bucket.requests} > ${limits.maxRequests}`);
    }
    if (limits.maxBytes !== undefined && bucket.bytes > limits.maxBytes) {
      violations.push(`${category} bytes ${bucket.bytes} > ${limits.maxBytes}`);
    }
  }
  return violations;
}
