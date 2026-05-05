const MAX_SAMPLES = 1000;

const latencySamplesMs = [];

const aggregate = {
  requests: 0,
  totalLatencyMs: 0,
  queryCounts: {
    products: 0,
    groups: 0,
    variants: 0,
    discounts: 0,
  },
};

const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
};

const recordListingsRequestMetrics = ({ durationMs, queryCounts = {} }) => {
  const safeDuration = Math.max(0, Number(durationMs) || 0);

  latencySamplesMs.push(safeDuration);
  if (latencySamplesMs.length > MAX_SAMPLES) {
    latencySamplesMs.shift();
  }

  aggregate.requests += 1;
  aggregate.totalLatencyMs += safeDuration;
  aggregate.queryCounts.products += Number(queryCounts.products) || 0;
  aggregate.queryCounts.groups += Number(queryCounts.groups) || 0;
  aggregate.queryCounts.variants += Number(queryCounts.variants) || 0;
  aggregate.queryCounts.discounts += Number(queryCounts.discounts) || 0;
};

const getListingsMetricsSnapshot = ({ reset = false } = {}) => {
  const snapshot = {
    requests: aggregate.requests,
    averageLatencyMs:
      aggregate.requests > 0 ? Math.round(aggregate.totalLatencyMs / aggregate.requests) : 0,
    p50LatencyMs: Math.round(quantile(latencySamplesMs, 0.5)),
    p95LatencyMs: Math.round(quantile(latencySamplesMs, 0.95)),
    p99LatencyMs: Math.round(quantile(latencySamplesMs, 0.99)),
    queryCounts: {
      ...aggregate.queryCounts,
    },
    avgQueriesPerRequest:
      aggregate.requests > 0
        ? {
            products: Number((aggregate.queryCounts.products / aggregate.requests).toFixed(2)),
            groups: Number((aggregate.queryCounts.groups / aggregate.requests).toFixed(2)),
            variants: Number((aggregate.queryCounts.variants / aggregate.requests).toFixed(2)),
            discounts: Number((aggregate.queryCounts.discounts / aggregate.requests).toFixed(2)),
          }
        : {
            products: 0,
            groups: 0,
            variants: 0,
            discounts: 0,
          },
  };

  if (reset) {
    latencySamplesMs.length = 0;
    aggregate.requests = 0;
    aggregate.totalLatencyMs = 0;
    aggregate.queryCounts.products = 0;
    aggregate.queryCounts.groups = 0;
    aggregate.queryCounts.variants = 0;
    aggregate.queryCounts.discounts = 0;
  }

  return snapshot;
};

module.exports = {
  recordListingsRequestMetrics,
  getListingsMetricsSnapshot,
};
