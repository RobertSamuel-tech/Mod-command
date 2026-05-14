import type { Context } from '@devvit/public-api';
import { Keys } from './redis-keys.js';

export interface WindowResult {
  triggered: boolean;
  count: number;
}

export interface DuplicateTextResult extends WindowResult {
  hash: string;
}

export interface Alert {
  type: string;
  details?: Record<string, unknown>;
  ts: number;
}

const SLIDING_WINDOW_TTL_SECONDS = 600;
const ALERT_LIST_MAX = 20;
const ALERT_TTL_SECONDS = 86_400;

async function recordSlidingWindow(
  ctx: Context,
  key: string,
  member: string,
  windowMs: number,
  ttlSeconds: number = SLIDING_WINDOW_TTL_SECONDS,
): Promise<number> {
  const now = Date.now();
  const cutoff = now - windowMs;

  await ctx.redis.zAdd(key, { score: now, member });
  await ctx.redis.zRemRangeByScore(key, 0, cutoff);
  await ctx.redis.expire(key, ttlSeconds);

  return ctx.redis.zCard(key);
}

function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function normalizeText(body: string): string {
  return body.toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function checkUserVelocity(
  ctx: Context,
  subId: string,
  userId: string,
  commentId: string,
  threshold = 5,
  windowMs = 600_000,
): Promise<WindowResult> {
  const key = Keys.patUser(subId, userId);
  const count = await recordSlidingWindow(ctx, key, commentId, windowMs);
  return { triggered: count >= threshold, count };
}

export async function checkDuplicateText(
  ctx: Context,
  subId: string,
  body: string,
  commentId: string,
  threshold = 3,
  windowMs = 300_000,
): Promise<DuplicateTextResult> {
  const normalized = normalizeText(body);
  if (normalized.length < 20) {
    return { triggered: false, count: 0, hash: '' };
  }

  const hash = djb2(normalized);
  const key = Keys.patText(subId, hash);
  const count = await recordSlidingWindow(ctx, key, commentId, windowMs);
  return { triggered: count >= threshold, count, hash };
}

export async function checkReportSpike(
  ctx: Context,
  subId: string,
  postId: string,
  threshold = 3,
  windowMs = 600_000,
): Promise<WindowResult> {
  const key = Keys.patReport(subId, postId);
  const member = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const count = await recordSlidingWindow(ctx, key, member, windowMs);
  return { triggered: count >= threshold, count };
}

export async function recordAlert(
  ctx: Context,
  subId: string,
  type: string,
  details: Record<string, unknown> = {},
): Promise<Alert> {
  const alert: Alert = { type, details, ts: Date.now() };
  const key = Keys.alert(subId);

  await ctx.redis.zAdd(key, {
    member: JSON.stringify(alert),
    score: alert.ts,
  });
  await ctx.redis.zRemRangeByRank(key, 0, -(ALERT_LIST_MAX + 1));
  await ctx.redis.expire(key, ALERT_TTL_SECONDS);

  return alert;
}

export async function listAlerts(
  ctx: Context,
  subId: string,
  max = 10,
): Promise<Alert[]> {
  const key = Keys.alert(subId);
  const items = await ctx.redis.zRange(key, -max, -1);
  if (!items || items.length === 0) return [];

  const alerts: Alert[] = [];
  for (const item of [...items].reverse()) {
    const str = typeof item === 'string' ? item : item?.member;
    if (!str) continue;
    try {
      alerts.push(JSON.parse(str) as Alert);
    } catch (err) {
      console.error('Failed to parse alert entry:', err);
    }
  }
  return alerts;
}
