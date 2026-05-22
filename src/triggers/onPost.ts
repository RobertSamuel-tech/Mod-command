import type { Context, TriggerContext } from '@devvit/public-api';
import { fireAlert } from '../state/fire-alerts.js';
import { addTriageItem } from '../state/triage.js';

// ── Keyword sets ─────────────────────────────────────────────────────────────

const KEYWORD_MATCH = [
  // Original threat keywords
  'fraud', 'lawsuit', 'exposed', 'scam', 'illegal',
  'banned', 'manipulation', 'stolen', 'abuse', 'warning',
  // Extended — covers "FREE crypto giveaway click now"
  'crypto', 'giveaway', 'leaked', 'airdrop', 'nft',
  'investment', 'hack', 'phishing', 'malware', 'ransomware',
  'free money', 'click now', 'dm me', 'make money',
];

const AI_FLAG_KEYWORDS = [
  'urgent', 'hacked', 'exploit', 'breach', 'compromised',
  'zero day', 'zero-day', 'backdoor', 'rootkit',
];

// ── Debug keys ───────────────────────────────────────────────────────────────

const DEBUG_TRIGGER_KEY = (subId: string) => `mc:debug:last_trigger:${subId}`;
const DEBUG_MODE_KEY    = (subId: string) => `mc:debug_mode:${subId}`;
const POST_VELOCITY_KEY = (subId: string) => `mc:post_velocity:${subId}`;

// ── Event interface ──────────────────────────────────────────────────────────

interface PostSubmitEvent {
  post?: { id?: string; title?: string; selftext?: string; body?: string };
  subreddit?: { id?: string };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function onPost(
  event: PostSubmitEvent,
  context: TriggerContext,
): Promise<void> {
  const subredditId = event.subreddit?.id;
  const post = event.post;
  if (!subredditId || !post?.id) return;

  const postId = post.id;
  const title  = post.title ?? '';
  // Handle both Devvit event shapes: post.body (Post class) vs post.selftext (raw event)
  const text   = `${title} ${post.selftext ?? post.body ?? ''}`.toLowerCase();

  // Always stamp that the trigger ran — visible in Dashboard footer
  try {
    await context.redis.set(
      DEBUG_TRIGGER_KEY(subredditId),
      new Date().toISOString(),
      { expiration: new Date(Date.now() + 3_600_000) },
    );
  } catch { /* non-critical */ }

  // ── Debug mode: force-create on EVERY post ───────────────────────────────
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

  // ── Spam-wave detection (post velocity sliding window) ───────────────────
  try {
    const now    = Date.now();
    const cutoff = now - 2 * 60 * 1000; // 2-minute window
    const velKey = POST_VELOCITY_KEY(subredditId);
    const member = `${now}_${Math.random().toString(36).slice(2, 8)}`;

    await context.redis.zAdd(velKey, { score: now, member });
    await context.redis.zRemRangeByScore(velKey, 0, cutoff);
    await context.redis.expire(velKey, 300);
    const recentCount = await context.redis.zCard(velKey);

    if (recentCount >= 3) {
      await fireAlert(context, subredditId, 'spam_wave', {
        count: recentCount,
        windowMinutes: 2,
        latestPost: title,
      });
    }
  } catch (err) { console.error('spam_wave detection failed:', err); }

  // ── Report-spike demo trigger (rpt / reporttest / reportsurge in title) ────
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

  // ── Keyword match → keyword_match alert + triage ─────────────────────────
  const matchedKeyword = KEYWORD_MATCH.find(kw => text.includes(kw));
  if (matchedKeyword) {
    try {
      await fireAlert(context, subredditId, 'keyword_match', {
        keyword: matchedKeyword, title, postId,
      });
    } catch (err) { console.error('keyword fireAlert failed:', err); }

    try {
      const aiScore = 94;
      if (aiScore >= 70) {
        await addTriageItem(context as unknown as Context, subredditId, {
          id: postId, itemId: postId,
          title: title.substring(0, 40),
          priority: aiScore >= 90 ? 'critical' : aiScore >= 75 ? 'high' : 'standard',
          aiScore, reports: 6, velocity: 0, age: 'Just now',
        });
      }
    } catch (err) { console.error('keyword addTriageItem failed:', err); }
  }

  // ── AI-flag detection → ai_flag alert + critical triage ──────────────────
  const aiFlagKeyword = AI_FLAG_KEYWORDS.find(kw => text.includes(kw));
  if (aiFlagKeyword) {
    try {
      await fireAlert(context, subredditId, 'ai_flag', {
        keyword: aiFlagKeyword, title, postId,
      });
    } catch (err) { console.error('ai_flag fireAlert failed:', err); }

    // Only add to triage if not already added by keyword match
    if (!matchedKeyword) {
      try {
        await addTriageItem(context as unknown as Context, subredditId, {
          id: postId, itemId: postId,
          title: title.substring(0, 40),
          priority: 'critical', aiScore: 91, reports: 4, velocity: 0, age: 'Just now',
        });
      } catch (err) { console.error('ai_flag addTriageItem failed:', err); }
    }
  }
}
