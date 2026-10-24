// Simple in-memory rate limiter. Good for a single instance.
// For multi-instance serverless deployments, swap with Upstash Redis
// (see README) — the call-sites stay identical.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear(); // crude memory bound
  return true;
}
