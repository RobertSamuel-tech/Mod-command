import type { Comment, Context, Post } from '@devvit/public-api';
import { releaseClaim } from '../state/claims.js';
import { getLiveChannel, type RTMessage } from '../realtime/channels.js';

export type ReleaseTarget = Post | Comment;

export async function runRelease(
  target: ReleaseTarget,
  context: Context,
): Promise<void> {
  const { ui, realtime } = context;
  const itemId = target.id;
  const subredditId = target.subredditId;

  try {
    await releaseClaim(context, subredditId, itemId);

    const message: RTMessage = { type: 'RELEASE', itemId };
    await realtime.send(getLiveChannel(subredditId), message);

    ui.showToast({ text: 'Released', appearance: 'success' });
  } catch (err) {
    console.error('Release failed:', err);
    ui.showToast({
      text: 'Release failed. Please try again.',
      appearance: 'neutral',
    });
    throw err;
  }
}
