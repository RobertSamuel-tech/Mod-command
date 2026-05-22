import type { Context } from '@devvit/public-api';
import { getRedisKey } from './redis-keys.js';

export interface HealthMetrics {
  firesPerDay: number;
  firesTrend: number;
  queueVolume: number;
  queueTrend: number;
  responseTime: number;
  responseTrend: number;
  avgHandleTime: number;
  handleTrend: number;
}

export async function getCommunityHealth(ctx: Context, subredditId: string): Promise<HealthMetrics> {
  const key = getRedisKey('health', subredditId);
  const raw = await ctx.redis.get(key);
  if (raw) return JSON.parse(raw) as HealthMetrics;
  return {
    firesPerDay: 28,
    firesTrend: 12,
    queueVolume: 14,
    queueTrend: -8,
    responseTime: 2.3,
    responseTrend: -40,
    avgHandleTime: 2.3,
    handleTrend: -40,
  };
}

export async function updateCommunityHealth(
  ctx: Context,
  subredditId: string,
  partial: Partial<HealthMetrics>
): Promise<void> {
  const key = getRedisKey('health', subredditId);
  const existing = await getCommunityHealth(ctx, subredditId);
  const updated = { ...existing, ...partial };
  await ctx.redis.set(key, JSON.stringify(updated), {
    expiration: new Date(Date.now() + 86_400_000),
  });
}
