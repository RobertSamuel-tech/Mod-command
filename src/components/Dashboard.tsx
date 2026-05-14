import {
  Devvit,
  useChannel,
  useInterval,
  useState,
  type Context,
} from '@devvit/public-api';
import { getLiveChannel, type RTMessage } from '../realtime/channels.js';
import { listActiveClaims, type ActiveClaim } from '../state/claims.js';
import { getTodayStats, type DailyStats } from '../state/stats.js';
import { listAlerts, type Alert } from '../state/patterns.js';
import { ClaimBadge } from './ClaimBadge.js';

const EMPTY_STATS: DailyStats = { defuses: 0, claims: 0, fires: 0 };

function formatAlert(alert: Alert): string {
  const details = (alert.details ?? {}) as Record<string, unknown>;
  const count = Number(details.count ?? 0);

  switch (alert.type) {
    case 'spam_wave':
      return `🔥 spam_wave — ${count} comments in 10 min`;
    case 'report_spike':
      return `🔥 report_spike — ${count} reports`;
    case 'copypasta_brigade':
      return `🔥 copypasta_brigade — repeated comments`;
    default:
      return `🔥 ${alert.type}`;
  }
}

export const Dashboard = (context: Context) => {
  const subredditId = context.subredditId ?? '';

  const [claims, setClaims] = useState<ActiveClaim[]>(async () => {
    if (!subredditId) return [];
    return listActiveClaims(context, subredditId);
  });

  const [stats, setStats] = useState<DailyStats>(async () => {
    if (!subredditId) return EMPTY_STATS;
    return getTodayStats(context, subredditId);
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const refreshAll = async () => {
    if (!subredditId) return;
    const [nextClaims, nextStats, nextAlerts] = await Promise.all([
      listActiveClaims(context, subredditId),
      getTodayStats(context, subredditId),
      listAlerts(context, subredditId, 10),
    ]);
    setClaims(nextClaims);
    setStats(nextStats);
    setAlerts(nextAlerts);
  };

  const refreshAlerts = async () => {
    if (!subredditId) return;
    const [nextAlerts, nextStats] = await Promise.all([
      listAlerts(context, subredditId, 10),
      getTodayStats(context, subredditId),
    ]);
    setAlerts(nextAlerts);
    setStats(nextStats);
  };

  const channel = useChannel<RTMessage>({
    name: subredditId ? getLiveChannel(subredditId) : 'mc_live_none',
    onMessage: (msg) => {
      if (msg.type === 'CLAIM' || msg.type === 'RELEASE') {
        void refreshAll();
      } else if (msg.type === 'FIRE') {
        void refreshAlerts();
      }
    },
  });
  channel.subscribe();

  const slowInterval = useInterval(() => {
    void refreshAll();
  }, 30_000);
  slowInterval.start();

  const alertInterval = useInterval(() => {
    void refreshAlerts();
  }, 5_000);
  alertInterval.start();

  return (
    <vstack padding="medium" gap="medium" grow>
      <text size="xlarge" weight="bold">
        ModCommand Dashboard
      </text>

      <vstack gap="small">
        <text size="large" weight="bold">
          Active Claims
        </text>
        {claims.length === 0 ? (
          <text color="neutral-content-weak">No active claims.</text>
        ) : (
          <vstack gap="small">
            {claims.map((c) => (
              <ClaimBadge key={c.itemId} modName={c.modName} itemId={c.itemId} />
            ))}
          </vstack>
        )}
      </vstack>

      <spacer size="small" />

      <vstack gap="small">
        <text size="large" weight="bold">
          🔥 Fire Radar
        </text>
        {alerts.length === 0 ? (
          <text color="neutral-content-weak">No recent fires.</text>
        ) : (
          <vstack gap="small">
            {alerts.map((alert, idx) => (
              <text key={`${alert.ts}_${idx}`}>{formatAlert(alert)}</text>
            ))}
          </vstack>
        )}
      </vstack>

      <spacer size="small" />

      <vstack gap="small">
        <text size="large" weight="bold">
          Today's Stats
        </text>
        <hstack gap="medium">
          <text>Defuses: {stats.defuses}</text>
          <text>Claims: {stats.claims}</text>
          <text>Fires: {stats.fires}</text>
        </hstack>
      </vstack>
    </vstack>
  );
};
