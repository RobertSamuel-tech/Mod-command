import type { Comment, Context, Post } from '@devvit/public-api';
import { incrementStat } from '../state/stats.js';
import { addAuditAction } from '../state/audit.js';
import { recordModAction } from '../state/modteam.js';
import { getLiveChannel } from '../realtime/channels.js';

export type DefuseTarget = Post | Comment;

export async function runDefuse(
  target: DefuseTarget,
  context: Context,
): Promise<void> {
  const { ui } = context;
  const subredditId = target.subredditId;
  const itemId = target.id;
  const itemType = 'title' in target ? 'post' : 'comment';

  try {
    await target.remove();
    await target.lock();
    await incrementStat(context, subredditId, 'defuses');

    ui.showToast({
      text: '⚡ Defuse complete: item removed and locked.',
      appearance: 'success',
    });

    await addAuditAction(context, subredditId, {
      time: new Date().toISOString(),
      mod: context.userId ?? 'unknown',
      action: 'DEFUSED',
      target: itemId,
      reason: itemType === 'post' ? 'Spam/Off-topic post' : 'Toxic comment',
      undoable: true,
    });

    await recordModAction(context, subredditId, context.userId ?? 'unknown');

    await context.realtime.send(getLiveChannel(subredditId), {
      type: 'AUDIT',
      action: 'DEFUSED',
      itemId,
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
