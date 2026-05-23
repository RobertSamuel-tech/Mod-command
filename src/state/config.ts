import type { Context } from '@devvit/public-api';
import { Keys } from './redis-keys.js';

export interface ModConfig {
  keywords: string[];
  spamThreshold: number;
  reportThreshold: number;
  flagSensitivity: 'low' | 'medium' | 'high';
}

export const DEFAULT_CONFIG: ModConfig = {
  keywords: ['scam', 'fraud', 'phishing', 'stolen', 'manipulation', 'hack', 'malware', 'crypto', 'giveaway', 'airdrop', 'free money', 'dm me'],
  spamThreshold: 3,
  reportThreshold: 3,
  flagSensitivity: 'medium',
};

export async function getConfig(ctx: Context, subId: string): Promise<ModConfig> {
  const raw = await ctx.redis.get(Keys.config(subId));
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setConfig(ctx: Context, subId: string, cfg: ModConfig): Promise<void> {
  await ctx.redis.set(Keys.config(subId), JSON.stringify(cfg));
}
