import type { Context } from '@devvit/public-api';
import { getRedisKey } from './redis-keys.js';

export interface TriageItem {
  id: string;
  itemId: string;
  title: string;
  priority: 'critical' | 'high' | 'standard';
  aiScore: number;
  reports: number;
  velocity: number;
  age: string;
  timestamp: number;
  claimedBy?: string;
}

const TTL = 86400;

export async function addTriageItem(
  ctx: Context,
  subredditId: string,
  item: Omit<TriageItem, 'timestamp'>
): Promise<void> {
  const key = getRedisKey('triage', subredditId);
  const fullItem: TriageItem = { ...item, timestamp: Date.now() };
  await ctx.redis.zAdd(key, { member: JSON.stringify(fullItem), score: Date.now() });
  await ctx.redis.expire(key, TTL);
}

export async function getTriageQueue(ctx: Context, subredditId: string): Promise<TriageItem[]> {
  const key = getRedisKey('triage', subredditId);
  const members = await ctx.redis.zRange(key, 0, -1);
  const items: TriageItem[] = members.map(m => {
    const str = typeof m === 'string' ? m : m?.member;
    try { return str ? JSON.parse(str) : null; } catch { return null; }
  }).filter((x): x is TriageItem => x !== null);

  if (items.length === 0) return [];

  // Parallel-check defused and escalated state for all items in one round-trip
  const [defusedChecks, escalatedChecks] = await Promise.all([
    Promise.all(items.map(item => ctx.redis.get(`mc:triage_defused:${subredditId}:${item.id}`))),
    Promise.all(items.map(item => ctx.redis.get(`mc:triage_escalated:${subredditId}:${item.id}`))),
  ]);

  const activeItems = items.filter((_item, i) => !defusedChecks[i] && !escalatedChecks[i]);

  const prioOrder: Record<TriageItem['priority'], number> = { critical: 0, high: 1, standard: 2 };
  return activeItems.sort((a, b) => {
    if (prioOrder[a.priority] !== prioOrder[b.priority]) return prioOrder[a.priority] - prioOrder[b.priority];
    return b.aiScore - a.aiScore;
  });
}

export async function claimTriageItem(ctx: Context, subredditId: string, id: string, modId: string): Promise<void> {
  await ctx.redis.set(
    `mc:triage_claim:${subredditId}:${id}`,
    modId,
    { expiration: new Date(Date.now() + 300_000) }
  );
}

export async function defuseTriageItem(ctx: Context, subredditId: string, id: string, modId: string): Promise<void> {
  await ctx.redis.set(
    `mc:triage_defused:${subredditId}:${id}`,
    modId,
    { expiration: new Date(Date.now() + 86_400_000) }
  );
}

export async function escalateTriageItem(ctx: Context, subredditId: string, id: string): Promise<void> {
  await ctx.redis.set(
    `mc:triage_escalated:${subredditId}:${id}`,
    '1',
    { expiration: new Date(Date.now() + 86_400_000) }
  );
}
