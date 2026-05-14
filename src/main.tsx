import { Devvit, type Comment, type Context, type Post } from '@devvit/public-api';
import { runDefuse } from './actions/defuse.js';
import { runClaim } from './actions/claim.js';
import { runRelease } from './actions/release.js';
import { Dashboard } from './components/Dashboard.js';
import { onComment } from './triggers/onComment.js';
import { onReport } from './triggers/onReport.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
  realtime: true,
});

type MenuLocation = 'post' | 'comment';

async function resolveTarget(
  location: MenuLocation | string,
  targetId: string,
  context: Context,
): Promise<Post | Comment | null> {
  const { reddit } = context;
  if (location === 'post') return reddit.getPostById(targetId);
  if (location === 'comment') return reddit.getCommentById(targetId);
  return null;
}

Devvit.addCustomPostType({
  name: 'ModCommand Dashboard',
  height: 'tall',
  render: Dashboard,
});

Devvit.addMenuItem({
  label: '⚡ Defuse',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const target = await resolveTarget(event.location, event.targetId, context);
    if (!target) {
      context.ui.showToast({ text: 'No target found.' });
      return;
    }
    await runDefuse(target, context);
  },
});

Devvit.addMenuItem({
  label: 'Claim',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const target = await resolveTarget(event.location, event.targetId, context);
    if (!target) {
      context.ui.showToast({ text: 'No target found.' });
      return;
    }
    await runClaim(target, context);
  },
});

Devvit.addMenuItem({
  label: 'Release',
  location: ['post', 'comment'],
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const target = await resolveTarget(event.location, event.targetId, context);
    if (!target) {
      context.ui.showToast({ text: 'No target found.' });
      return;
    }
    await runRelease(target, context);
  },
});

Devvit.addMenuItem({
  label: 'Create ModCommand Dashboard',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const sub = await reddit.getCurrentSubreddit();
    await reddit.submitPost({
      title: 'ModCommand Dashboard',
      subredditName: sub.name,
      preview: (
        <vstack padding="medium" alignment="center middle">
          <text>Loading ModCommand Dashboard…</text>
        </vstack>
      ),
    });
    ui.showToast({
      text: 'Dashboard created.',
      appearance: 'success',
    });
  },
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: onComment,
});

Devvit.addTrigger({
  event: 'PostReport',
  onEvent: onReport,
});

Devvit.addTrigger({
  event: 'CommentReport',
  onEvent: onReport,
});

export default Devvit;
