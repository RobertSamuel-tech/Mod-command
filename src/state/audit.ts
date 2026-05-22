import type { Context } from '@devvit/public-api';
import { getRedisKey } from './redis-keys.js';

export interface AuditAction {
  id: string;
  time: string;
  mod: string;
  action: string;
  target: string;
  reason: string;
  undoable: boolean;
}

const MAX_AUDIT = 50;

export async function addAuditAction(
  ctx: Context,
  subredditId: string,
  action: Omit<AuditAction, 'id'>
): Promise<void> {
  const key = getRedisKey('audit', subredditId);
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const entry: AuditAction = { ...action, id };
  await ctx.redis.zAdd(key, { member: JSON.stringify(entry), score: Date.now() });
  await ctx.redis.expire(key, 604800);

  const count = await ctx.redis.zCard(key);
  if (count > MAX_AUDIT) {
    await ctx.redis.zRemRangeByRank(key, 0, count - MAX_AUDIT - 1);
  }
}

export async function getRecentActions(ctx: Context, subredditId: string, limit = 10): Promise<AuditAction[]> {
  const key = getRedisKey('audit', subredditId);
  const members = await ctx.redis.zRange(key, -limit, -1);
  const items: AuditAction[] = [...members].reverse().map(m => {
    const str = typeof m === 'string' ? m : m?.member;
    try { return str ? JSON.parse(str) : null; } catch { return null; }
  }).filter((x): x is AuditAction => x !== null);
  return items;
}
