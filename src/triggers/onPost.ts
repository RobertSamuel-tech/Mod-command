import type { TriggerContext } from '@devvit/public-api';
import { fireAlert } from '../state/fire-alerts.js';

const KEYWORDS = [
  'fraud',
  'lawsuit',
  'exposed',
  'scam',
  'illegal',
  'banned',
  'manipulation',
  'stolen',
  'abuse',
  'warning',
];

interface PostSubmitEvent {
  post?: { id?: string; title?: string; selftext?: string };
  subreddit?: { id?: string };
}

export async function onPost(
  event: PostSubmitEvent,
  context: TriggerContext,
): Promise<void> {
  try {
    const subredditId = event.subreddit?.id;
    const post = event.post;

    if (!subredditId || !post?.id) return;

    const text = `${post.title ?? ''} ${post.selftext ?? ''}`.toLowerCase();
    const keyword = KEYWORDS.find((kw) => text.includes(kw));

    if (keyword) {
      await fireAlert(context, subredditId, 'keyword_match', {
        keyword,
        title: post.title ?? '',
        postId: post.id,
      });
    }
  } catch (err) {
    console.error('onPost trigger failed:', err);
  }
}
