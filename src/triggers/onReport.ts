import type { TriggerContext } from '@devvit/public-api';
import { checkReportSpike } from '../state/patterns.js';
import { fireAlert } from '../state/fire-alerts.js';

interface ReportEvent {
  subreddit?: { id?: string };
  post?: { id?: string };
  comment?: { id?: string };
  targetId?: string;
  reason?: string;
}

export async function onReport(
  event: ReportEvent,
  context: TriggerContext,
): Promise<void> {
  try {
    const subredditId = event.subreddit?.id;
    const postId =
      event.post?.id ?? event.comment?.id ?? event.targetId ?? '';

    if (!subredditId || !postId) return;

    const spike = await checkReportSpike(context, subredditId, postId);
    if (spike.triggered) {
      await fireAlert(context, subredditId, 'report_spike', {
        postId,
        count: spike.count,
      });
    }
  } catch (err) {
    console.error('onReport trigger failed:', err);
  }
}
