import type { Context } from '@devvit/public-api';
import { Keys } from './redis-keys.js';

export type StatField = 'defuses' | 'claims' | 'fires' | 'restores';

export interface DailyStats {
  defuses: number;
  claims: number;
  fires: number;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementStat(
  ctx: Context,
  subredditId: string,
  field: StatField,
): Promise<void> {
  const key = Keys.stat(subredditId, todayUTC());
  await ctx.redis.hIncrBy(key, field, 1);
}

export async function getTodayStats(
  ctx: Context,
  subredditId: string,
): Promise<DailyStats> {
  const key = Keys.stat(subredditId, todayUTC());
  const data = (await ctx.redis.hGetAll(key)) ?? {};
  return {
    defuses: Number(data.defuses ?? 0) || 0,
    claims: Number(data.claims ?? 0) || 0,
    fires: Number(data.fires ?? 0) || 0,
  };
}
