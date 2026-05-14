import type { Comment, Context, Post } from '@devvit/public-api';
import { getClaim, setClaim } from '../state/claims.js';
import { getLiveChannel, type RTMessage } from '../realtime/channels.js';
import { incrementStat } from '../state/stats.js';

export type ClaimTarget = Post | Comment;

export async function runClaim(
  target: ClaimTarget,
  context: Context,
): Promise<void> {
  const { ui, reddit, realtime } = context;
  const itemId = target.id;
  const subredditId = target.subredditId;

  try {
    const existing = await getClaim(context, subredditId, itemId);
    if (existing) {
      ui.showToast({ text: `Already claimed by u/${existing.modName}` });
      return;
    }

    const me = await reddit.getCurrentUser();
    if (!me) {
      ui.showToast({
        text: 'Could not identify current moderator.',
        appearance: 'neutral',
      });
      return;
    }

    await setClaim(context, subredditId, itemId, me.id, me.username);
    await incrementStat(context, subredditId, 'claims');

    const message: RTMessage = {
      type: 'CLAIM',
      itemId,
      modName: me.username,
    };
    await realtime.send(getLiveChannel(subredditId), message);

    ui.showToast({ text: 'Claimed for 5 minutes', appearance: 'success' });
  } catch (err) {
    console.error('Claim failed:', err);
    ui.showToast({
      text: 'Claim failed. Please try again.',
      appearance: 'neutral',
    });
    throw err;
  }
}
