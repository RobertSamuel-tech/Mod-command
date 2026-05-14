import type { Context } from '@devvit/public-api';
import { recordAlert } from './patterns.js';
import { incrementStat } from './stats.js';
import { getLiveChannel, type RTMessage } from '../realtime/channels.js';

export type FireAlertType =
  | 'spam_wave'
  | 'copypasta_brigade'
  | 'report_spike'
  | string;

export async function fireAlert(
  ctx: Context,
  subId: string,
  type: FireAlertType,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await recordAlert(ctx, subId, type, details);
    await incrementStat(ctx, subId, 'fires');

    const message: RTMessage = {
      type: 'FIRE',
      details: { alertType: type, ...details },
    };
    await ctx.realtime.send(getLiveChannel(subId), message);

    console.log(`[fire] ${type}`, details);
  } catch (err) {
    console.error('fireAlert failed:', err);
  }
}
