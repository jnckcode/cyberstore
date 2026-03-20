import type { NextRequest } from "next/server";

const memoryRateLimiter = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: Request | NextRequest) {
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (!trustProxy) {
    return "unknown";
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first && first.length <= 128) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  const candidate = realIp?.trim();
  if (candidate && candidate.length <= 128) {
    return candidate;
  }

  return "unknown";
}

export function consumeMemoryRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = memoryRateLimiter.get(key);

  if (!current || now > current.resetAt) {
    memoryRateLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  current.count += 1;
  memoryRateLimiter.set(key, current);

  const remaining = Math.max(max - current.count, 0);
  const retryAfterSec = Math.max(Math.ceil((current.resetAt - now) / 1000), 1);
  return { allowed: current.count <= max, remaining, retryAfterSec };
}
