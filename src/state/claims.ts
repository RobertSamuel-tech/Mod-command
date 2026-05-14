import type { Context } from '@devvit/public-api';
import { Keys } from './redis-keys.js';

export interface ClaimRecord {
  modId: string;
  modName: string;
  ts: number;
}

export interface ActiveClaim {
  itemId: string;
  modName: string;
  ts: number;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 300;

function claimsHashKey(subredditId: string): string {
  return `mc:claims:${subredditId}`;
}

export async function setClaim(
  ctx: Context,
  subId: string,
  itemId: string,
  modId: string,
  modName: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<ClaimRecord> {
  const ts = Date.now();
  const expiresAt = ts + ttlSeconds * 1000;
  const record: ClaimRecord = { modId, modName, ts };

  await ctx.redis.set(Keys.claim(subId, itemId), JSON.stringify(record), {
    expiration: new Date(expiresAt),
  });

  await ctx.redis.hSet(claimsHashKey(subId), {
    [itemId]: JSON.stringify({ modId, modName, ts, expiresAt }),
  });

  return record;
}

export async function getClaim(
  ctx: Context,
  subId: string,
  itemId: string,
): Promise<ClaimRecord | null> {
  const raw = await ctx.redis.get(Keys.claim(subId, itemId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ClaimRecord;
  } catch (err) {
    console.error('Failed to parse claim record:', err);
    return null;
  }
}

export async function releaseClaim(
  ctx: Context,
  subId: string,
  itemId: string,
): Promise<void> {
  await ctx.redis.del(Keys.claim(subId, itemId));
  await ctx.redis.hDel(claimsHashKey(subId), [itemId]);
}

export async function isClaimed(
  ctx: Context,
  subId: string,
  itemId: string,
): Promise<boolean> {
  return (await getClaim(ctx, subId, itemId)) !== null;
}

export async function listActiveClaims(
  ctx: Context,
  subredditId: string,
): Promise<ActiveClaim[]> {
  const raw = await ctx.redis.hGetAll(claimsHashKey(subredditId));
  if (!raw) return [];

  const now = Date.now();
  const active: ActiveClaim[] = [];

  for (const [itemId, value] of Object.entries(raw)) {
    try {
      const parsed = JSON.parse(value) as {
        modId?: string;
        modName: string;
        ts: number;
        expiresAt: number;
      };
      if (parsed.expiresAt < now) continue;
      active.push({
        itemId,
        modName: parsed.modName,
        ts: parsed.ts,
        expiresAt: parsed.expiresAt,
      });
    } catch (err) {
      console.error(`Failed to parse claim ${itemId}:`, err);
    }
  }

  active.sort((a, b) => b.ts - a.ts);
  return active;
}
