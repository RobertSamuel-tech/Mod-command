import type { TriggerContext } from '@devvit/public-api';
import { checkDuplicateText, checkUserVelocity } from '../state/patterns.js';
import { fireAlert } from '../state/fire-alerts.js';

interface CommentSubmitEvent {
  comment?: { id?: string; body?: string };
  author?: { id?: string };
  subreddit?: { id?: string };
}

export async function onComment(
  event: CommentSubmitEvent,
  context: TriggerContext,
): Promise<void> {
  try {
    const subredditId = event.subreddit?.id;
    const authorId = event.author?.id;
    const commentId = event.comment?.id;
    const body = event.comment?.body ?? '';

    if (!subredditId || !authorId || !commentId) return;

    const velocity = await checkUserVelocity(
      context,
      subredditId,
      authorId,
      commentId,
    );
    if (velocity.triggered) {
      await fireAlert(context, subredditId, 'spam_wave', {
        authorId,
        count: velocity.count,
      });
    }

    const duplicate = await checkDuplicateText(
      context,
      subredditId,
      body,
      commentId,
    );
    if (duplicate.triggered) {
      await fireAlert(context, subredditId, 'copypasta_brigade', {
        count: duplicate.count,
      });
    }
  } catch (err) {
    console.error('onComment trigger failed:', err);
  }
}
