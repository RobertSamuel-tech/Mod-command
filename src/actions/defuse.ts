import type { Comment, Context, Post } from '@devvit/public-api';
import { incrementStat } from '../state/stats.js';

export type DefuseTarget = Post | Comment;

export async function runDefuse(
  target: DefuseTarget,
  context: Context,
): Promise<void> {
  const { ui } = context;

  try {
    await target.remove();
    await target.lock();
    await incrementStat(context, target.subredditId, 'defuses');

    ui.showToast({
      text: '⚡ Defuse complete: item removed and locked.',
      appearance: 'success',
    });
  } catch (err) {
    console.error('Defuse failed:', err);
    ui.showToast({
      text: 'Defuse failed. Please try again.',
      appearance: 'neutral',
    });
    throw err;
  }
}
