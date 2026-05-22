import type { Context } from '@devvit/public-api';
import { getRedisKey } from './redis-keys.js';

export interface ModStatus {
  name: string;
  status: 'online' | 'busy' | 'away';
  actions: number;
  lastAction: string;
}

export async function recordModAction(ctx: Context, subredditId: string, modName: string): Promise<void> {
  const key = getRedisKey('modteam', subredditId);
  const existing = await ctx.redis.hGet(key, modName);
  let data: ModStatus;
  if (existing) {
    data = JSON.parse(existing) as ModStatus;
    data.actions += 1;
    data.status = 'busy';
    data.lastAction = new Date().toISOString();
  } else {
    data = { name: modName, status: 'online', actions: 1, lastAction: new Date().toISOString() };
  }
  await ctx.redis.hSet(key, { [modName]: JSON.stringify(data) });
  await ctx.redis.expire(key, 86400);
}

export async function getModTeamStatus(ctx: Context, subredditId: string): Promise<ModStatus[]> {
  const key = getRedisKey('modteam', subredditId);
  const hash = await ctx.redis.hGetAll(key);
  const mods: ModStatus[] = Object.values(hash ?? {}).map(v => {
    try { return JSON.parse(v) as ModStatus; } catch { return null; }
  }).filter((x): x is ModStatus => x !== null);
  return mods.sort((a, b) => b.actions - a.actions);
}
