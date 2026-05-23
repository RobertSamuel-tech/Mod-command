import type { Context } from '@devvit/public-api';
import { addAuditAction } from '../state/audit.js';
import { incrementStat } from '../state/stats.js';
import { getLiveChannel } from '../realtime/channels.js';

export async function restoreItem(
  ctx: Context,
  subredditId: string,
  postId: string,
): Promise<void> {
  // Re-approve on Reddit
  const post = await ctx.reddit.getPostById(postId);
  await post.approve();

  // Unlock — defuse locks the post; ignore if already unlocked
  try { await post.unlock(); } catch { /* already unlocked */ }

  // Clear defused marker so it re-enters the triage queue if needed
  await ctx.redis.del(`mc:triage_defused:${subredditId}:${postId}`);

  // Audit trail
  await addAuditAction(ctx, subredditId, {
    time: new Date().toISOString(),
    mod: ctx.userId ?? 'unknown',
    action: 'RESTORED',
    target: postId,
    reason: 'restored_post',
    undoable: false,
  });

  // Stats
  await incrementStat(ctx, subredditId, 'restores');

  // Realtime push so all open dashboards refresh
  await ctx.realtime.send(getLiveChannel(subredditId), {
    type: 'AUDIT',
    action: 'RESTORED',
    itemId: postId,
  });
}
