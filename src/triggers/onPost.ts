import type { Context, TriggerContext } from '@devvit/public-api';
import { fireAlert } from '../state/fire-alerts.js';
import { addTriageItem } from '../state/triage.js';
import { getConfig } from '../state/config.js';

const AI_FLAG_KEYWORDS = [
  'urgent', 'hacked', 'exploit', 'breach', 'compromised',
  'zero day', 'zero-day', 'backdoor', 'rootkit',
];

const DEBUG_TRIGGER_KEY = (subId: string) => `mc:debug:last_trigger:${subId}`;
const DEBUG_MODE_KEY    = (subId: string) => `mc:debug_mode:${subId}`;
const POST_VELOCITY_KEY = (subId: string) => `mc:post_velocity:${subId}`;

interface PostSubmitEvent {
  post?: { id?: string; title?: string; selftext?: string; body?: string };
  subreddit?: { id?: string };
}

export async function onPost(
  event: PostSubmitEvent,
  context: TriggerContext,
): Promise<void> {
  const subredditId = event.subreddit?.id;
  const post = event.post;
  if (!subredditId || !post?.id) return;

  const postId = post.id;
  const title  = post.title ?? '';
  const text   = `${title} ${post.selftext ?? post.body ?? ''}`.toLowerCase();

  // Stamp trigger time for Dashboard footer
  try {
    await context.redis.set(
      DEBUG_TRIGGER_KEY(subredditId),
      new Date().toISOString(),
      { expiration: new Date(Date.now() + 3_600_000) },
    );
  } catch { /* non-critical */ }

  // Load subreddit-specific moderation config
  const cfg = await getConfig(context as unknown as Context, subredditId);
  const flagThreshold = cfg.flagSensitivity === 'low' ? 90 : cfg.flagSensitivity === 'medium' ? 80 : 70;

  // ── Debug mode: force-create on EVERY post ──────────────────────────────
  const debugMode = await context.redis.get(DEBUG_MODE_KEY(subredditId));
  if (debugMode === '1') {
    try {
      await fireAlert(context, subredditId, 'keyword_match', {
        keyword: '[debug-forced]', title, postId,
      });
    } catch (err) { console.error('debug fireAlert failed:', err); }
    try {
      await addTriageItem(context as unknown as Context, subredditId, {
        id: postId, itemId: postId,
        title: title.substring(0, 40),
        priority: 'high', aiScore: 85, reports: 1, velocity: 0, age: 'Just now',
      });
    } catch (err) { console.error('debug addTriageItem failed:', err); }
    return;
  }

  // ── Spam-wave detection (post velocity sliding window) ──────────────────
  try {
    const now    = Date.now();
    const cutoff = now - 2 * 60 * 1000;
    const velKey = POST_VELOCITY_KEY(subredditId);
    const member = `${now}_${Math.random().toString(36).slice(2, 8)}`;

    await context.redis.zAdd(velKey, { score: now, member });
    await context.redis.zRemRangeByScore(velKey, 0, cutoff);
    await context.redis.expire(velKey, 300);
    const recentCount = await context.redis.zCard(velKey);

    if (recentCount >= cfg.spamThreshold) {
      await fireAlert(context, subredditId, 'spam_wave', {
        count: recentCount,
        windowMinutes: 2,
        latestPost: title,
      });
    }
  } catch (err) { console.error('spam_wave detection failed:', err); }

  // ── Report-spike demo trigger ────────────────────────────────────────────
  const RPT_DEMO_KEYWORDS = ['rpt', 'reporttest', 'reportsurge'];
  const rptDemoHit = RPT_DEMO_KEYWORDS.find(kw => text.includes(kw));
  if (rptDemoHit) {
    try {
      await fireAlert(context, subredditId, 'report_spike', {
        count: 8, source: 'demo', keyword: rptDemoHit, title, postId,
      });
    } catch (err) { console.error('rpt_demo fireAlert failed:', err); }
    try {
      await addTriageItem(context as unknown as Context, subredditId, {
        id: `rpt_${postId}`, itemId: postId,
        title: title.substring(0, 40),
        priority: 'high', aiScore: 82, reports: 8, velocity: 3, age: 'Just now',
      });
    } catch (err) { console.error('rpt_demo addTriageItem failed:', err); }
  }

  // ── Keyword match (uses config.keywords) ───────────────────────────────
  const matchedKeyword = cfg.keywords.find(kw => text.includes(kw));
  if (matchedKeyword) {
    try {
      await fireAlert(context, subredditId, 'keyword_match', {
        keyword: matchedKeyword, title, postId,
      });
    } catch (err) { console.error('keyword fireAlert failed:', err); }

    try {
      const aiScore = 94;
      if (aiScore >= flagThreshold) {
        await addTriageItem(context as unknown as Context, subredditId, {
          id: postId, itemId: postId,
          title: title.substring(0, 40),
          priority: aiScore >= 90 ? 'critical' : aiScore >= 75 ? 'high' : 'standard',
          aiScore, reports: 6, velocity: 0, age: 'Just now',
        });
      }
    } catch (err) { console.error('keyword addTriageItem failed:', err); }
  }

  // ── AI-flag detection ──────────────────────────────────────────────────
  const aiFlagKeyword = AI_FLAG_KEYWORDS.find(kw => text.includes(kw));
  if (aiFlagKeyword) {
    try {
      await fireAlert(context, subredditId, 'ai_flag', {
        keyword: aiFlagKeyword, title, postId,
      });
    } catch (err) { console.error('ai_flag fireAlert failed:', err); }

    if (!matchedKeyword) {
      try {
        const aiScore = 91;
        if (aiScore >= flagThreshold) {
          await addTriageItem(context as unknown as Context, subredditId, {
            id: postId, itemId: postId,
            title: title.substring(0, 40),
            priority: 'critical', aiScore, reports: 4, velocity: 0, age: 'Just now',
          });
        }
      } catch (err) { console.error('ai_flag addTriageItem failed:', err); }
    }
  }
}
