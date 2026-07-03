import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

function envInt(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const hasUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let warnedMissing = false;

const redis = hasUpstash ? Redis.fromEnv() : null;

function makeLimiter(tokens: number, window: `${number} s` | `${number} m` | `${number} h`, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `rl:${prefix}`,
  });
}

// Env-tunable defaults. Renders are expensive; uploads are cheap but abusable.
const limiters = {
  jobsUserMinute: makeLimiter(envInt("RATELIMIT_JOBS_PER_MIN", 5), "60 s", "jobs:u:m"),
  jobsUserHour: makeLimiter(envInt("RATELIMIT_JOBS_PER_HOUR", 30), "1 h", "jobs:u:h"),
  jobsIpMinute: makeLimiter(envInt("RATELIMIT_JOBS_IP_PER_MIN", 10), "60 s", "jobs:ip:m"),
  uploadsUserMinute: makeLimiter(envInt("RATELIMIT_UPLOADS_PER_MIN", 10), "60 s", "uploads:u:m"),
  uploadsIpMinute: makeLimiter(envInt("RATELIMIT_UPLOADS_IP_PER_MIN", 20), "60 s", "uploads:ip:m"),
  // Public lead form: IP-only (no authenticated user)
  leadsIpMinute: makeLimiter(envInt("RATELIMIT_LEADS_IP_PER_MIN", 3), "60 s", "leads:ip:m"),
  leadsIpHour: makeLimiter(envInt("RATELIMIT_LEADS_IP_PER_HOUR", 10), "1 h", "leads:ip:h"),
};

export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec?: number;
}

async function check(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) return { ok: true };
  const result = await limiter.limit(identifier);
  if (result.success) return { ok: true };
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}

export async function checkRateLimit(
  scope: "jobs" | "uploads" | "leads",
  userId: string,
  ip: string | null
): Promise<RateLimitResult> {
  if (!redis) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn("[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled");
    }
    return { ok: true };
  }

  const checks =
    scope === "jobs"
      ? [
          check(limiters.jobsUserMinute, userId),
          check(limiters.jobsUserHour, userId),
          ...(ip ? [check(limiters.jobsIpMinute, ip)] : []),
        ]
      : scope === "uploads"
      ? [
          check(limiters.uploadsUserMinute, userId),
          ...(ip ? [check(limiters.uploadsIpMinute, ip)] : []),
        ]
      : [
          // leads: unauthenticated — IP is the only identity we have
          check(limiters.leadsIpMinute, ip ?? "unknown"),
          check(limiters.leadsIpHour, ip ?? "unknown"),
        ];

  const results = await Promise.all(checks);
  const blocked = results.find((r) => !r.ok);
  return blocked ?? { ok: true };
}
