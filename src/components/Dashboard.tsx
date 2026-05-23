import { Devvit, useState, useAsync, useInterval, useChannel } from '@devvit/public-api';
import type { Context, JSONObject } from '@devvit/public-api';
import { getTodayStats } from '../state/stats.js';
import type { DailyStats } from '../state/stats.js';
import { listActiveClaims } from '../state/claims.js';
import { listAlerts } from '../state/patterns.js';
import { getTriageQueue, claimTriageItem, defuseTriageItem, escalateTriageItem } from '../state/triage.js';
import { getRecentActions } from '../state/audit.js';
import type { AuditAction } from '../state/audit.js';
import { getModTeamStatus } from '../state/modteam.js';
import type { ModStatus } from '../state/modteam.js';
import { getCommunityHealth } from '../state/health.js';
import type { HealthMetrics } from '../state/health.js';
import { getLiveChannel } from '../realtime/channels.js';
import { runDefuse } from '../actions/defuse.js';
import { restoreItem } from '../actions/restore.js';
import { getConfig, setConfig } from '../state/config.js';
import type { ModConfig } from '../state/config.js';

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const fmtTs = (ts?: number): string => (ts ? fmtTime(new Date(ts).toISOString()) : '—');
const trendArrow = (n: number): string => (n > 0 ? '↑' : n < 0 ? '↓' : '→');
const fmtCount = (n: number): string => (n > 0 ? `${n}` : '—');

const CONFIG_PRESETS = [
  'scam', 'fraud', 'phishing', 'hack', 'malware',
  'crypto', 'giveaway', 'airdrop', 'free money', 'dm me', 'stolen', 'urgent',
];

type SafeAlert = { type: string; details: JSONObject | null; ts: number };
type SafeTriageItem = {
  id: string; itemId: string; title: string;
  priority: 'critical' | 'high' | 'standard';
  aiScore: number; reports: number; velocity: number;
  age: string; timestamp: number; claimedBy: string | null;
};
type DashData = {
  stats: DailyStats;
  alerts: SafeAlert[];
  triage: SafeTriageItem[];
  audit: AuditAction[];
  modTeam: ModStatus[];
  health: HealthMetrics;
  config: ModConfig;
  timeSaved: number;
  autoActions: number;
  modActions: number;
  debugMode: boolean;
  lastTrigger: string | null;
};

type View = 'main' | 'settings' | 'analytics';

// Module-level render counter — does NOT cause state changes
let _renderCount = 0;

export function Dashboard(ctx: Context) {
  _renderCount++;

  // ── All hooks must be declared before any early returns ───────────────────
  const [view, setView]           = useState<View>('main');
  const [lastSync, setLastSync]   = useState<string>(new Date().toISOString());
  const [tick, setTick]           = useState<number>(0);
  const [cfgPatch, setCfgPatch]   = useState<Partial<ModConfig>>({});
  const [cfgSaving, setCfgSaving] = useState<boolean>(false);
  const [init, setInit]           = useState<boolean>(false);

  console.log(`[Dashboard] RENDER #${_renderCount} view=${view} tick=${tick} init=${init}`);

  const subredditId = ctx.subredditId ?? 'unknown';

  const channel = useChannel<{ type: string }>({
    name: getLiveChannel(subredditId),
    onMessage: (msg) => {
      console.log('[Dashboard] REALTIME msg:', msg?.type);
      if (msg?.type) setTick((t) => t + 1);
    },
  });

  const { data, loading } = useAsync<DashData>(
    async (): Promise<DashData> => {
      console.log(`[Dashboard] useAsync RUN — tick=${tick}`);
      const [stats, , rawAlerts, rawTriage, audit, modTeam, health, config, debugRaw, lastTrigger] =
        await Promise.all([
          getTodayStats(ctx, subredditId),
          listActiveClaims(ctx, subredditId),
          listAlerts(ctx, subredditId, 10),
          getTriageQueue(ctx, subredditId),
          getRecentActions(ctx, subredditId, 6),
          getModTeamStatus(ctx, subredditId),
          getCommunityHealth(ctx, subredditId),
          getConfig(ctx, subredditId),
          ctx.redis.get(`mc:debug_mode:${subredditId}`),
          ctx.redis.get(`mc:debug:last_trigger:${subredditId}`),
        ]);

      const modActions = (stats.defuses ?? 0) + (stats.claims ?? 0);
      const autoActions = stats.fires ?? 0;
      const timeSaved = Math.round((autoActions * 0.5 + modActions * 0.25) / 6) / 10;

      return {
        stats,
        alerts: rawAlerts.map((a) => ({
          type: a.type,
          details: (a.details as JSONObject | null) ?? null,
          ts: a.ts,
        })),
        triage: rawTriage.map((t) => ({
          id: t.id, itemId: t.itemId, title: t.title, priority: t.priority,
          aiScore: t.aiScore, reports: t.reports, velocity: t.velocity,
          age: t.age, timestamp: t.timestamp, claimedBy: t.claimedBy ?? null,
        })),
        audit,
        modTeam,
        health,
        config,
        timeSaved,
        autoActions,
        modActions,
        debugMode: debugRaw === '1',
        lastTrigger: lastTrigger ?? null,
      };
    },
    { depends: [tick] },
  );

  const refreshInterval = useInterval(() => {
    console.log('[Dashboard] INTERVAL FIRE — tick bump');
    setTick((t) => t + 1);
    setLastSync(new Date().toISOString());
  }, 5000);

  // ── One-time subscription / interval start (GUARDED) ─────────────────────
  // Without this guard, every render creates a new timer and re-subscribes,
  // causing exponential timer accumulation → "Exceeded maximum iterations".
  if (!init) {
    console.log('[Dashboard] ONE-TIME INIT: subscribe + start interval');
    channel.subscribe();
    refreshInterval.start();
    setInit(true);
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  const refresh = () => {
    console.log('[Dashboard] MANUAL REFRESH');
    setTick((t) => t + 1);
  };

  const handleClaimNext = async () => {
    console.log('[Dashboard] ACTION: claimNext');
    const item = data?.triage?.find((t) => !t.claimedBy);
    if (!item) { ctx.ui.showToast('No unclaimed items in queue'); return; }
    await claimTriageItem(ctx, subredditId, item.id, ctx.userId ?? 'system');
    ctx.ui.showToast(`Claimed ${item.id}`);
    refresh();
  };
  const handleClaim = async (id: string) => {
    console.log('[Dashboard] ACTION: claim', id);
    await claimTriageItem(ctx, subredditId, id, ctx.userId ?? 'system');
    refresh();
  };
  const handleDefuse = async (item: SafeTriageItem) => {
    console.log('[Dashboard] ACTION: defuse — item.id:', item.id, 'postId:', item.itemId);
    try {
      const post = await ctx.reddit.getPostById(item.itemId);
      console.log('[Dashboard] defuse fetched post:', post.id);
      await runDefuse(post, ctx);
    } catch (err) {
      console.error('[Dashboard] defuse failed:', err);
      ctx.ui.showToast({ text: 'Defuse failed — check mod permissions', appearance: 'neutral' });
      return;
    }
    try {
      await defuseTriageItem(ctx, subredditId, item.id, ctx.userId ?? 'system');
    } catch (err) {
      console.error('[Dashboard] defuse queue cleanup failed:', err);
    }
    refresh();
  };
  const handleEscalate = async (id: string) => {
    console.log('[Dashboard] ACTION: escalate', id);
    await escalateTriageItem(ctx, subredditId, id);
    refresh();
  };
  const handleUndo = async (postId: string) => {
    console.log('[Dashboard] ACTION: undo/restore', postId);
    try {
      await restoreItem(ctx, subredditId, postId);
      ctx.ui.showToast({ text: '↩ Post restored and re-approved', appearance: 'success' });
    } catch (err) {
      console.error('[Dashboard] restore failed:', err);
      ctx.ui.showToast({ text: 'Restore failed — check mod permissions', appearance: 'neutral' });
    }
    refresh();
  };
  const handleToggleDebug = async () => {
    console.log('[Dashboard] ACTION: toggleDebug');
    const key = `mc:debug_mode:${subredditId}`;
    const cur = await ctx.redis.get(key);
    if (cur === '1') {
      await ctx.redis.del(key);
      ctx.ui.showToast('Debug OFF — keyword detection active');
    } else {
      await ctx.redis.set(key, '1', { expiration: new Date(Date.now() + 86_400_000) });
      ctx.ui.showToast('Debug ON — every post forces an alert');
    }
    refresh();
  };
  const handleSaveConfig = async () => {
    console.log('[Dashboard] ACTION: saveConfig');
    if (!data) return;
    setCfgSaving(true);
    try {
      const merged: ModConfig = { ...data.config, ...cfgPatch };
      await setConfig(ctx, subredditId, merged);
      setCfgPatch({});
      ctx.ui.showToast({ text: 'Settings saved', appearance: 'success' });
      console.log('[Dashboard] setView → main (after save)');
      setView('main');
      refresh();
    } catch (err) {
      console.error('[Dashboard] config save failed:', err);
      ctx.ui.showToast({ text: 'Save failed', appearance: 'neutral' });
    }
    setCfgSaving(false);
  };

  // ── Analytics view ────────────────────────────────────────────────────────

  if (view === 'analytics') {
    return (
      <vstack gap="small" padding="small" grow>
        <hstack gap="small" alignment="center middle">
          <text size="large" weight="bold">Analytics</text>
          <spacer grow />
          <button size="small" onPress={() => { console.log('[Dashboard] setView → main'); setView('main'); }}>← Back</button>
        </hstack>
        <text size="xsmall" color="neutral-content-weak">Analytics panel — detailed mod activity charts coming soon.</text>
      </vstack>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <vstack gap="small" padding="small" alignment="center middle" grow>
        <text size="large" weight="bold">ModCommand dashboard</text>
        <text size="xsmall" color="neutral-content-weak">Loading Command Center...</text>
      </vstack>
    );
  }

  // ── Settings / Config panel ───────────────────────────────────────────────

  if (view === 'settings') {
    const cfg: ModConfig = { ...data.config, ...cfgPatch };

    const toggleKw = (kw: string) => {
      console.log('[Dashboard] ACTION: toggleKw', kw);
      const has = cfg.keywords.includes(kw);
      setCfgPatch({
        ...cfgPatch,
        keywords: has ? cfg.keywords.filter((k) => k !== kw) : [...cfg.keywords, kw],
      });
    };

    return (
      <vstack gap="small" padding="small" grow>

        {/* Header */}
        <hstack gap="small" alignment="center middle">
          <text size="large" weight="bold">Configure</text>
          <spacer grow />
          <button size="small" onPress={() => { console.log('[Dashboard] setView → main (cancel)'); setCfgPatch({}); setView('main'); }}>← Back</button>
        </hstack>

        {/* Keywords */}
        <vstack gap="none">
          <hstack gap="small" alignment="center middle">
            <text size="xsmall" weight="bold">KEYWORDS</text>
            <text size="xsmall" color="neutral-content-weak">({cfg.keywords.length} active — tap to toggle)</text>
          </hstack>
          <text size="xsmall" color="neutral-content-weak">Toggle words that trigger realtime alerts</text>
        </vstack>
        <hstack gap="small">
          {CONFIG_PRESETS.slice(0, 6).map((kw) => (
            <button
              key={kw}
              size="small"
              appearance={cfg.keywords.includes(kw) ? 'primary' : 'secondary'}
              onPress={() => toggleKw(kw)}
            >{kw}</button>
          ))}
        </hstack>
        <hstack gap="small">
          {CONFIG_PRESETS.slice(6).map((kw) => (
            <button
              key={kw}
              size="small"
              appearance={cfg.keywords.includes(kw) ? 'primary' : 'secondary'}
              onPress={() => toggleKw(kw)}
            >{kw}</button>
          ))}
        </hstack>

        {/* Spam threshold */}
        <hstack gap="small" alignment="center middle">
          <vstack grow>
            <text size="xsmall" weight="bold">Spam Threshold</text>
            <text size="xsmall" color="neutral-content-weak">Posts within 2 minutes before spam alert</text>
          </vstack>
          <hstack gap="small" alignment="center middle">
            <button size="small" onPress={() => setCfgPatch({ ...cfgPatch, spamThreshold: Math.max(1, cfg.spamThreshold - 1) })}>-</button>
            <text weight="bold">{cfg.spamThreshold.toString()}</text>
            <button size="small" onPress={() => setCfgPatch({ ...cfgPatch, spamThreshold: Math.min(10, cfg.spamThreshold + 1) })}>+</button>
          </hstack>
        </hstack>

        {/* Report spike threshold */}
        <hstack gap="small" alignment="center middle">
          <vstack grow>
            <text size="xsmall" weight="bold">Report Spike</text>
            <text size="xsmall" color="neutral-content-weak">Reports required before escalation</text>
          </vstack>
          <hstack gap="small" alignment="center middle">
            <button size="small" onPress={() => setCfgPatch({ ...cfgPatch, reportThreshold: Math.max(1, cfg.reportThreshold - 1) })}>-</button>
            <text weight="bold">{cfg.reportThreshold.toString()}</text>
            <button size="small" onPress={() => setCfgPatch({ ...cfgPatch, reportThreshold: Math.min(10, cfg.reportThreshold + 1) })}>+</button>
          </hstack>
        </hstack>

        {/* Flag sensitivity */}
        <hstack gap="small" alignment="center middle">
          <vstack grow>
            <text size="xsmall" weight="bold">Flag Sensitivity</text>
            <text size="xsmall" color="neutral-content-weak">Triage escalation aggressiveness</text>
          </vstack>
          <hstack gap="small">
            {(['low', 'medium', 'high'] as const).map((l) => (
              <button
                key={l}
                size="small"
                appearance={cfg.flagSensitivity === l ? 'primary' : 'secondary'}
                onPress={() => setCfgPatch({ ...cfgPatch, flagSensitivity: l })}
              >{l[0].toUpperCase() + l.slice(1)}</button>
            ))}
          </hstack>
        </hstack>

        <spacer size="small" />

        {/* Save / Cancel */}
        <hstack gap="small">
          <button grow appearance="primary" onPress={handleSaveConfig} disabled={cfgSaving}>
            {cfgSaving ? 'Saving…' : 'Save Settings'}
          </button>
          <button grow appearance="secondary" onPress={() => { console.log('[Dashboard] setView → main (cancel)'); setCfgPatch({}); setView('main'); }}>
            Cancel
          </button>
        </hstack>

      </vstack>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const { alerts, triage, audit, modTeam, health, timeSaved, autoActions, modActions, debugMode, lastTrigger } = data;

  const critical   = triage.find((t) => t.priority === 'critical');
  const high       = triage.find((t) => t.priority === 'high');
  const standard   = triage.find((t) => t.priority === 'standard');
  const triageEmpty = triage.length === 0;

  const spamAlerts    = alerts.filter((a) => a.type === 'spam_wave');
  const reportAlerts  = alerts.filter((a) => a.type === 'report_spike');
  const keywordAlerts = alerts.filter((a) => a.type === 'keyword_match');
  const aiFlagAlerts  = alerts.filter((a) => a.type === 'ai_flag');

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <vstack gap="small" padding="xsmall" grow>

      {/* ── Header ── */}
      <hstack gap="small" alignment="center middle">
        <text size="large" weight="bold">ModCommand dashboard</text>
        <spacer grow />
        <text size="xsmall" weight="bold">● LIVE</text>
        <button appearance="secondary" size="small" onPress={() => { console.log('[Dashboard] setView → settings'); setView('settings'); }}>⚙ Settings</button>
      </hstack>

      {/* ── Row 1: Time Saved + Triage Queue ── */}
      <hstack gap="small">

        {/* Time Saved */}
        <vstack gap="none" padding="xsmall" cornerRadius="medium" grow>
          <text size="xsmall" weight="bold">TIME SAVED TODAY</text>
          {timeSaved === 0 ? (
            <vstack gap="none">
              <text size="large" weight="bold">0.0 hrs</text>
              <text size="xsmall" color="neutral-content-weak">Start moderating to see time saved</text>
            </vstack>
          ) : (
            <hstack gap="small" alignment="bottom">
              <text size="large" weight="bold">{timeSaved}</text>
              <text size="xsmall">hrs</text>
            </hstack>
          )}
          <hstack gap="small">
            <text size="xsmall" color="neutral-content-weak">Auto: {autoActions}</text>
            <text size="xsmall" color="neutral-content-weak">· Mod: {modActions}</text>
          </hstack>
        </vstack>

        {/* Triage Queue */}
        <vstack gap="small" padding="xsmall" cornerRadius="medium" grow>
          <hstack alignment="center middle">
            <text size="xsmall" weight="bold">TRIAGE QUEUE</text>
            <spacer grow />
            <button size="small" onPress={handleClaimNext}>Claim Next</button>
          </hstack>

          {triageEmpty ? (
            <hstack gap="small" alignment="center middle">
              <text size="xsmall" weight="bold" color="#46D160">✓</text>
              <text size="xsmall" color="neutral-content-weak">Queue clear — community is healthy</text>
              <spacer grow />
            </hstack>
          ) : (
            <vstack gap="small">
              {critical ? (
                <hstack gap="small" padding="xsmall" cornerRadius="small" border="thin" alignment="center middle">
                  <text size="xsmall" weight="bold" color="#FF4500">● CRIT</text>
                  <text size="xsmall">{critical.title}</text>
                  <spacer grow />
                  <text size="xsmall" color="neutral-content-weak">Score:{critical.aiScore}%</text>
                  <button size="small" onPress={() => handleClaim(critical.id)}>Claim</button>
                  <button size="small" appearance="secondary" onPress={() => handleDefuse(critical)}>Defuse</button>
                  <button size="small" appearance="secondary" onPress={() => handleEscalate(critical.id)}>Esc</button>
                </hstack>
              ) : undefined}
              {high ? (
                <hstack gap="small" padding="xsmall" cornerRadius="small" border="thin" alignment="center middle">
                  <text size="xsmall" weight="bold" color="#FF8717">● HIGH</text>
                  <text size="xsmall">{high.title}</text>
                  <spacer grow />
                  <text size="xsmall" color="neutral-content-weak">Score:{high.aiScore}%</text>
                  <button size="small" onPress={() => handleClaim(high.id)}>Claim</button>
                  <button size="small" appearance="secondary" onPress={() => handleDefuse(high)}>Defuse</button>
                </hstack>
              ) : undefined}
              {standard ? (
                <hstack gap="small" padding="xsmall" cornerRadius="small" border="thin" alignment="center middle">
                  <text size="xsmall" weight="bold" color="#46D160">● STD</text>
                  <text size="xsmall">{standard.title}</text>
                  <spacer grow />
                  <text size="xsmall" color="neutral-content-weak">Score:{standard.aiScore}%</text>
                  <button size="small" onPress={() => handleClaim(standard.id)}>Claim</button>
                  <button size="small" appearance="secondary" onPress={() => handleDefuse(standard)}>Defuse</button>
                </hstack>
              ) : undefined}
            </vstack>
          )}
        </vstack>
      </hstack>

      {/* ── Fire Radar ── */}
      <vstack gap="small" padding="xsmall" cornerRadius="medium">
        <hstack alignment="center middle">
          <text size="xsmall" weight="bold">🔥 FIRE RADAR</text>
          <spacer grow />
          <button appearance="plain" size="small" onPress={() => { console.log('[Dashboard] setView → settings (configure)'); setView('settings'); }}>Configure →</button>
        </hstack>

        <hstack gap="small">
          <vstack gap="none" padding="xsmall" cornerRadius="small" grow>
            <text size="xsmall" weight="bold">SPAM</text>
            <text size="xsmall" weight="bold" color={spamAlerts.length > 0 ? '#FF4500' : '#46D160'}>
              {spamAlerts.length > 0 ? `⚠ ${fmtCount(spamAlerts.length)}` : '✓ Clear'}
            </text>
            <text size="xsmall" color="neutral-content-weak">{fmtTs(spamAlerts[0]?.ts)}</text>
          </vstack>

          <vstack gap="none" padding="xsmall" cornerRadius="small" grow>
            <text size="xsmall" weight="bold">RPT</text>
            <text size="xsmall" weight="bold" color={reportAlerts.length > 0 ? '#FF4500' : '#46D160'}>
              {reportAlerts.length > 0 ? `⚠ ${fmtCount(reportAlerts.length)}` : '✓ Clear'}
            </text>
            <text size="xsmall" color="neutral-content-weak">{fmtTs(reportAlerts[0]?.ts)}</text>
          </vstack>

          <vstack gap="none" padding="xsmall" cornerRadius="small" grow>
            <text size="xsmall" weight="bold">KEYWORD</text>
            <text size="xsmall" weight="bold" color={keywordAlerts.length > 0 ? '#FF8717' : '#46D160'}>
              {keywordAlerts.length > 0 ? `⚠ ${fmtCount(keywordAlerts.length)}` : '✓ Clear'}
            </text>
            <text size="xsmall" color="neutral-content-weak">{fmtTs(keywordAlerts[0]?.ts)}</text>
          </vstack>

          <vstack gap="none" padding="xsmall" cornerRadius="small" grow>
            <text size="xsmall" weight="bold">FLAG</text>
            <text size="xsmall" weight="bold" color={aiFlagAlerts.length > 0 ? '#FF4500' : '#46D160'}>
              {aiFlagAlerts.length > 0 ? `⚠ ${fmtCount(aiFlagAlerts.length)}` : '✓ Clear'}
            </text>
            <text size="xsmall" color="neutral-content-weak">{fmtTs(aiFlagAlerts[0]?.ts)}</text>
          </vstack>
        </hstack>
      </vstack>

      {/* ── Mod Team + Community Health ── */}
      <hstack gap="small">

        {/* Mod Team */}
        <vstack gap="small" padding="xsmall" cornerRadius="medium" grow>
          <text size="xsmall" weight="bold">MOD TEAM</text>

          {modTeam.length === 0 ? (
            <text size="xsmall" color="neutral-content-weak">● You — start moderating to appear here</text>
          ) : (
            <vstack gap="none">
              {modTeam.slice(0, 2).map((mod, idx) => (
                <hstack key={`mod-${idx}`} gap="small" alignment="center middle">
                  <text size="xsmall">{mod.status === 'online' ? '🟢' : mod.status === 'busy' ? '🟡' : '⚫'}</text>
                  <text size="xsmall" weight="bold">{mod.name}</text>
                  <text size="xsmall" color="neutral-content-weak">{mod.actions}x</text>
                  <spacer grow />
                  <text size="xsmall" color="neutral-content-weak">{mod.status.toUpperCase()}</text>
                </hstack>
              ))}
            </vstack>
          )}

          <text size="xsmall" color="neutral-content-weak">
            Handle: {health.avgHandleTime}m {trendArrow(health.handleTrend)}{Math.abs(health.handleTrend)}%
          </text>
        </vstack>

        {/* Community Health */}
        <vstack gap="small" padding="xsmall" cornerRadius="medium" grow>
          <text size="xsmall" weight="bold">COMMUNITY HEALTH (7d)</text>

          <hstack gap="small" alignment="center middle">
            <text size="xsmall" color="neutral-content-weak">Fires/day</text>
            <text size="xsmall" weight="bold">{health.firesPerDay}</text>
            <spacer grow />
            <text size="xsmall" color="neutral-content-weak">{trendArrow(health.firesTrend)}{Math.abs(health.firesTrend)}%</text>
          </hstack>

          <hstack gap="small" alignment="center middle">
            <text size="xsmall" color="neutral-content-weak">Queue avg</text>
            <text size="xsmall" weight="bold">{health.queueVolume}</text>
            <spacer grow />
            <text size="xsmall" color="neutral-content-weak">{trendArrow(health.queueTrend)}{Math.abs(health.queueTrend)}%</text>
          </hstack>

          <hstack gap="small" alignment="center middle">
            <text size="xsmall" color="neutral-content-weak">Response</text>
            <text size="xsmall" weight="bold">{health.responseTime}m</text>
            <spacer grow />
            <text size="xsmall" color="neutral-content-weak">{trendArrow(health.responseTrend)}{Math.abs(health.responseTrend)}%</text>
          </hstack>
        </vstack>
      </hstack>

      {/* ── Audit Trail ── */}
      <vstack gap="small" padding="xsmall" cornerRadius="medium">
        <text size="xsmall" weight="bold">🕐 RECENT ACTIONS</text>
        {audit.length === 0 ? (
          <text size="xsmall" color="neutral-content-weak">No actions recorded yet today.</text>
        ) : (
          <vstack gap="small">
            {audit.slice(0, 2).map((action, idx) => (
              <hstack key={`audit-${idx}`} gap="small" alignment="center middle">
                <text size="xsmall" color="neutral-content-weak">[{fmtTime(action.time)}]</text>
                <text size="xsmall" weight="bold">{action.mod}</text>
                <text size="xsmall" weight="bold">{action.action}</text>
                <text size="xsmall" color="neutral-content-weak">{action.target.substring(0, 14)}</text>
                <spacer grow />
                {action.undoable ? (
                  <button size="small" appearance="secondary" onPress={() => handleUndo(action.target)}>Undo</button>
                ) : null}
              </hstack>
            ))}
          </vstack>
        )}
      </vstack>

      {/* ── Footer ── */}
      <hstack gap="small" alignment="center middle">
        <button size="small" onPress={refresh}>↻ Refresh</button>
        <button size="small" appearance={debugMode ? 'secondary' : 'plain'} onPress={handleToggleDebug}>
          {debugMode ? '🐛 Debug: ON' : 'Debug'}
        </button>
        <spacer grow />
        {lastTrigger ? (
          <text size="xsmall" color="neutral-content-weak">Trigger: {fmtTime(lastTrigger)}</text>
        ) : (
          <text size="xsmall" color="neutral-content-weak">No trigger yet</text>
        )}
        <text size="xsmall" color="neutral-content-weak">· {fmtTime(lastSync)}</text>
      </hstack>

    </vstack>
  );
}
