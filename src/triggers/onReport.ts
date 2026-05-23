import type { Context, TriggerContext } from '@devvit/public-api';
import { checkReportSpike } from '../state/patterns.js';
import { fireAlert } from '../state/fire-alerts.js';
import { getConfig } from '../state/config.js';

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

    const cfg = await getConfig(context as unknown as Context, subredditId);
    const spike = await checkReportSpike(context, subredditId, postId);

    if (spike.triggered && spike.count >= cfg.reportThreshold) {
      await fireAlert(context, subredditId, 'report_spike', {
        postId,
        count: spike.count,
      });
    }
  } catch (err) {
    console.error('onReport trigger failed:', err);
  }
}
