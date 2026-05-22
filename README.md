# ModCommand

### Realtime AI-Assisted Moderation Command Center for Reddit

ModCommand is a native Reddit moderation platform built entirely on **Reddit Devvit**. It gives mod teams a coordinated, realtime command center — surfaced as a live custom post directly inside their subreddit — with automated threat detection, a prioritized triage queue, per-moderator claim tracking, a full audit trail, and community health dashboards.

Built for subreddits that outgrow manual moderation workflows and need operational tooling to match.

---

## The Problem

Reddit moderation at scale is operationally broken:

- **Moderator collisions** — two mods remove the same post simultaneously, wasting effort and creating confusing mod logs
- **No coordination layer** — there is no native way for mod teams to see who is handling what in real time
- **Spam waves hit faster than humans can respond** — by the time a mod notices a flood of low-effort posts, dozens have already landed
- **Report spikes are invisible** — a post receiving 20 reports in 5 minutes looks identical to one with 1 report until a mod manually checks
- **Alert fatigue** — mods working large communities receive a constant stream of reports with no prioritization signal
- **Manual workflows don't scale** — every action is reactive and isolated; there is no shared operational picture
- **No accountability trail** — when something goes wrong, reconstructing who took which action and when is difficult

ModCommand addresses each of these directly, operating inside Reddit rather than alongside it.

---

## Solution Overview

ModCommand installs as a Devvit app and creates a **Dashboard custom post** inside your subreddit. Every moderator who opens the post sees the same live operational view, synchronized in real time via Devvit's realtime channels.

**What it does:**

| Capability | What it solves |
|---|---|
| **Fire Radar** | Automatically detects spam waves, report spikes, keyword threats, and AI-flagged content the moment they appear |
| **AI Triage Queue** | Prioritizes flagged content into Critical / High / Standard lanes with heuristic scoring so mods work the most important items first |
| **Claim system** | Lets a mod claim a triage item to signal "I have this" — preventing duplicate effort |
| **Defuse** | One-click remove + lock directly from the dashboard or any post/comment context menu |
| **Audit Trail** | Logs every moderation action with timestamp, moderator, and undo capability |
| **Mod Team panel** | Shows active moderator status and action counts, updated in real time |
| **Community Health** | 7-day rolling metrics: fires/day, queue volume, response time, average handle time |
| **Realtime sync** | All dashboard panels refresh via live channel events; no polling required |

Everything runs **natively inside Reddit**. There is no external dashboard, no third-party service, no browser extension.

---

## Core Features

| Feature | Description | Reddit Value |
|---|---|---|
| **Claim** | Reserves a content item for the claiming moderator with a 5-minute TTL | Eliminates duplicate moderation work across the team |
| **Release** | Clears a claim so another moderator can take it | Prevents items from being stuck when a mod goes idle |
| **Defuse** | Removes and locks a post or comment in a single action; records the action in the audit trail | Reduces remove → lock to one click from anywhere in Reddit |
| **Spam Wave Detection** | Detects when ≥ 3 posts or ≥ 5 comments from the same user appear within a 2-minute sliding window | Catches coordinated low-effort floods before they fill the feed |
| **Report Spike Detection (RPT)** | Fires an alert when the same item receives ≥ 3 reports within 10 minutes | Surfaces genuinely problematic content above the noise floor |
| **Keyword Detection** | Scans post titles and body text against a curated threat keyword list on every submission | Catches scam, fraud, phishing, and manipulation content at post time |
| **AI Flag Detection** | Secondary keyword pass for high-severity security language (zero-day, exploit, breach, backdoor) | Escalates technically dangerous content to Critical priority immediately |
| **Fire Radar** | Live four-panel widget showing SPAM / RPT / KEYWORD / AI FLAG status with timestamps | Gives mod teams a shared threat picture at a glance |
| **AI Triage Queue** | Priority-scored queue (Critical → High → Standard) with per-item Claim, Defuse, and Escalate controls | Structured workflow that keeps mods working the right items in the right order |
| **Audit Trail** | Timestamped log of the last 50 moderation actions across the team, with Undo support | Creates accountability and makes moderation history reviewable |
| **Community Health Metrics** | 7-day rolling: fires/day, queue volume, response time, average handle time, with trend indicators | Gives subreddit owners operational visibility into moderation performance |
| **Mod Team Coordination** | Real-time panel showing each moderator's status (online / busy / away) and today's action count | Situational awareness across the mod team without leaving Reddit |
| **Realtime Sync** | Dashboard updates pushed via Devvit realtime channels on every CLAIM, RELEASE, FIRE, and AUDIT event | Zero-latency coordination — all mods see the same state simultaneously |
| **Undo Actions** | Flagged actions in the audit trail expose an Undo button wired to the restore pipeline | Reduces the cost of accidental moderation actions |

---

## Moderation Workflow

```
1. A suspicious post is submitted to the subreddit

2. Fire Radar detects the threat
   ├── PostSubmit trigger scans title + body for keywords and AI-flag terms
   ├── Spam wave detector checks post velocity in a 2-minute sliding window
   └── Report spike detector fires if ≥ 3 reports land within 10 minutes

3. AI Triage Queue receives the item
   └── Priority assigned: Critical (AI score ≥ 90) → High (≥ 75) → Standard

4. Fire Radar widget updates in real time
   └── Affected channel (SPAM / RPT / KEYWORD / AI FLAG) flips from ✓ Clear to ⚠

5. A moderator sees the alert and claims the triage item
   └── "I have this" — claim locks the item for 5 minutes, visible to the entire team

6. Moderator reviews and defuses
   └── One-click: post is removed and locked; defuse count increments

7. Dashboard updates across all open instances
   └── Realtime AUDIT event pushes the change to every mod viewing the dashboard

8. Audit Trail records the action
   └── Timestamp, mod username, action type, target ID — retrievable and undoable

9. Queue item clears automatically
   └── Defused items are filtered from the queue on next load
```

---

## Reddit-Native Integration

ModCommand is **not** an external moderation dashboard that mirrors Reddit data to a third-party service. It runs entirely inside Reddit using the Devvit platform.

- **Custom post type** — the Dashboard is a first-class Reddit post, visible and interactive to any moderator in the subreddit
- **Server-side triggers** — PostSubmit, CommentSubmit, PostReport, and CommentReport events are handled server-side by Devvit trigger handlers, not by a polling service
- **Devvit Blocks UI** — the Dashboard is built with Devvit's native component system (vstack, hstack, text, button) — no external frontend framework
- **Redis state layer** — all claim records, alert queues, triage items, audit logs, mod team status, and health metrics are stored in Devvit's built-in Redis
- **Realtime channels** — CLAIM, RELEASE, FIRE, and AUDIT events are broadcast over Devvit's realtime pub/sub system and received by live dashboard instances without polling
- **Context menu actions** — Defuse, Claim, and Release appear in the native Reddit context menu on posts and comments, available to moderators from anywhere in the subreddit

No API keys. No webhooks. No external servers. No browser extensions.

---

## Architecture

```
Reddit Platform
│
├── PostSubmit ────────► onPost.ts
│                           ├── Keyword scan (KEYWORD_MATCH list)
│                           ├── AI-flag scan (AI_FLAG_KEYWORDS list)
│                           ├── Spam wave detector (post velocity, 2-min window)
│                           └── Report-spike demo trigger (RPT keywords)
│
├── CommentSubmit ─────► onComment.ts
│                           ├── checkUserVelocity()   — ≥ 5 comments / 10 min
│                           └── checkDuplicateText()  — same body ≥ 3× / 5 min
│
├── PostReport ────────► onReport.ts
└── CommentReport ─────► onReport.ts
                            └── checkReportSpike()    — ≥ 3 reports / 10 min
                                                             │
                                              ┌──────────────▼──────────────┐
                                              │         fireAlert()          │
                                              │  recordAlert() → Redis zset  │
                                              │  incrementStat() → Redis hash│
                                              │  realtime.send(FIRE event)   │
                                              └──────────────┬──────────────┘
                                                             │
                                              ┌──────────────▼──────────────┐
                                              │      addTriageItem()         │
                                              │  Priority + score assigned   │
                                              │  Stored in Redis sorted set  │
                                              └──────────────┬──────────────┘

Moderator context-menu action (Defuse / Claim / Release)
│
├── runDefuse()    → remove() + lock() + incrementStat() + addAuditAction()
│                    + recordModAction() + realtime.send(AUDIT)
├── runClaim()     → setClaim() + realtime.send(CLAIM)
└── runRelease()   → releaseClaim() + realtime.send(RELEASE)
                                                             │
                                              ┌──────────────▼──────────────┐
                                              │     Dashboard.tsx            │
                                              │  useChannel (CLAIM/RELEASE/  │
                                              │    FIRE/AUDIT) → re-render   │
                                              │  useInterval 5s → refresh    │
                                              │                              │
                                              │  ┌─ Fire Radar (4 channels) ┐│
                                              │  ├─ AI Triage Queue          ││
                                              │  ├─ Mod Team Status          ││
                                              │  ├─ Community Health (7d)    ││
                                              │  └─ Audit Trail (last 50)   ┘│
                                              └─────────────────────────────┘
```

---

## Project Structure

```
modcommand/
├── src/
│   ├── main.tsx                  # App entry — registers triggers, menu items, custom post type
│   │
│   ├── actions/                  # Moderator actions invoked from context menus
│   │   ├── defuse.ts             # remove() + lock() + audit + mod tracking + realtime broadcast
│   │   ├── claim.ts              # Claim an item with 5-min TTL, broadcast CLAIM event
│   │   ├── release.ts            # Release a claim, broadcast RELEASE event
│   │   └── restore.ts            # Scaffold — restore/approve a removed item
│   │
│   ├── components/               # Devvit Blocks UI
│   │   ├── Dashboard.tsx         # Main custom post — all panels, realtime channel, 5s interval
│   │   ├── ClaimBadge.tsx        # Single active claim row
│   │   └── FireAlert.tsx         # Single fire alert row
│   │
│   ├── config/
│   │   └── settings.ts           # App-level configuration constants
│   │
│   ├── engine/
│   │   ├── orchestrator.ts       # Scaffold — central mod-action orchestration
│   │   └── reddit-api.ts         # Scaffold — Reddit API helpers
│   │
│   ├── realtime/
│   │   └── channels.ts           # Channel name builder + RTMessage type definition
│   │
│   ├── state/                    # All Redis read/write logic
│   │   ├── redis-keys.ts         # Centralised key builders (mc:claim:…, mc:stat:…, etc.)
│   │   ├── claims.ts             # setClaim / getClaim / releaseClaim / listActiveClaims
│   │   ├── fire-alerts.ts        # fireAlert() — records alert, increments stat, broadcasts FIRE
│   │   ├── patterns.ts           # Sliding-window detectors: velocity, duplicate text, report spike
│   │   ├── stats.ts              # incrementStat / getTodayStats
│   │   ├── audit.ts              # addAuditAction / getRecentActions — 50-entry log, 7-day TTL
│   │   ├── modteam.ts            # recordModAction / getModTeamStatus — online/busy/away tracking
│   │   ├── health.ts             # getCommunityHealth / updateCommunityHealth — 7-day metrics
│   │   └── triage.ts             # addTriageItem / getTriageQueue / claimTriageItem /
│   │                             # defuseTriageItem / escalateTriageItem
│   │
│   └── triggers/                 # Devvit server-side event handlers
│       ├── onPost.ts             # PostSubmit — keyword scan, AI-flag scan, spam wave, triage
│       ├── onComment.ts          # CommentSubmit — user velocity + duplicate text detection
│       └── onReport.ts           # PostReport / CommentReport — report spike detection
│
├── assets/
│   └── icon.png
│
├── devvit.yaml                   # App name, version, Reddit API permissions
├── package.json
└── README.md
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Reddit Devvit** | App platform — triggers, custom posts, context menu actions, Redis, realtime |
| **TypeScript** | Full codebase — type-safe state, events, and component props |
| **Redis (Devvit built-in)** | All persistent state: claims, alerts, triage queue, audit log, mod team, health metrics |
| **Devvit Realtime Channels** | Sub-100ms push events for CLAIM, RELEASE, FIRE, and AUDIT — zero polling |
| **Devvit Blocks** | Native Reddit UI component system — vstack, hstack, text, button, useChannel, useAsync |
| **Reddit APIs (Devvit SDK)** | Post and comment operations — remove(), lock(), getPostById() |

---

## Fire Radar

Fire Radar is the threat detection layer. It monitors four independent signal channels and surfaces alerts to the dashboard the moment a threshold is crossed.

### SPAM — Post and Comment Velocity

**Post velocity:** tracks how many posts land in a 2-minute sliding window using a Redis sorted set. If ≥ 3 posts arrive within that window, a `spam_wave` alert fires.

**Comment velocity:** tracks how many comments a single user submits within a 10-minute window. If the same user posts ≥ 5 comments in that period, a `spam_wave` alert fires.

Both checks run server-side on every submission — no polling, no delay.

### RPT — Report Spike Detection

Tracks the timestamp of every report received on a specific post or comment. If ≥ 3 reports arrive within a 10-minute sliding window, a `report_spike` alert fires and the item is added to the triage queue at High priority.

### KEYWORD — Threat Keyword Matching

Every post submission is scanned against two keyword lists:

- **Standard threat keywords** — fraud, scam, phishing, stolen, manipulation, illegal, lawsuit, exposed, hack, malware, crypto, giveaway, airdrop, free money, dm me, and others
- Post title and body text are both scanned; matches fire a `keyword_match` alert and add the post to the triage queue

### AI FLAG — High-Severity Signal Detection

A second keyword pass runs against a curated list of high-severity security terms: exploit, breach, zero-day, backdoor, rootkit, compromised, hacked, urgent. Matches fire an `ai_flag` alert and the item is added to the triage queue at Critical priority.

**Dashboard behavior:** Each channel displays its current state (✓ Clear or ⚠ N alerts) with the timestamp of the most recent event. Alerts persist in a Redis sorted set capped at 20 entries and expire after 24 hours.

---

## AI Triage Queue

The triage queue is the operational core of ModCommand. Rather than presenting a flat list of reports, it organizes flagged content into priority lanes and gives moderators a structured workflow to process it.

### Priority Scoring

Items enter the queue when a Fire Radar detector fires. Priority is assigned based on the detection signal:

| Detection signal | Priority | Typical AI Score |
|---|---|---|
| AI Flag keyword | Critical | 91+ |
| High-score keyword match | Critical | ≥ 90 |
| Keyword match | High | 75–89 |
| Report spike | High | 82 |
| Spam wave | Standard | 70–74 |

Items within the same priority tier are sorted by score descending, so the highest-confidence detections surface first.

### Claim, Defuse, Escalate

Each triage item exposes three controls directly in the dashboard:

- **Claim** — reserves the item for the claiming moderator (5-minute TTL stored in Redis). The entire team can see who has claimed what, preventing duplicate work.
- **Defuse** — fetches the post via Reddit API, calls remove() and lock(), records the action in the audit trail, updates daily stats, and broadcasts an AUDIT event to all open dashboard instances. The item is then marked as defused and filtered from the queue.
- **Escalate** — marks the item as escalated (flagged for senior review) and removes it from the active queue.

### Collision Prevention

If a moderator claims an item, the claim is visible to every other mod with the dashboard open. When a second mod opens the same triage item, they see it is already claimed and can move to the next unclaimed item instead. The "Claim Next" button at the top of the queue always advances to the first unclaimed item.

---

## Audit Trail

The audit trail is a transparent, timestamped log of moderation actions taken across the team.

Every Defuse action writes an entry containing:
- Timestamp (ISO 8601)
- Moderator user ID
- Action type (DEFUSED)
- Target item ID
- Reason (post type — spam/off-topic post, toxic comment)
- Undoable flag

**Storage:** Up to 50 actions are retained in a Redis sorted set scored by timestamp. The log expires after 7 days. Entries are capped at 50 to prevent unbounded growth; older entries are trimmed automatically when the limit is reached.

**Undo:** Actions flagged as undoable expose an Undo button in the dashboard, wired to the restore pipeline.

**Visibility:** The audit trail panel is visible to all moderators in the dashboard, not just the mod who took the action. This creates team-wide accountability without requiring separate logging infrastructure.

---

## Community Health Metrics

The Community Health panel provides a 7-day rolling view of moderation performance across four dimensions:

| Metric | Description |
|---|---|
| **Fires / day** | Average number of Fire Radar alerts per day over the 7-day window |
| **Queue volume** | Average number of items in the triage queue per day |
| **Response time** | Average time (minutes) from alert creation to first claim |
| **Avg handle time** | Average time (minutes) from claim to defuse |

Each metric is displayed alongside a trend indicator (↑ / ↓ / →) and percentage change, giving moderators and subreddit owners a clear signal of whether the community's threat posture is improving or worsening over time.

---

## Redis Key Reference

| Key pattern | Type | Purpose |
|---|---|---|
| `mc:claim:<subId>:<itemId>` | String (JSON) | Active claim record with TTL |
| `mc:claims:<subId>` | Hash | Index of all active claims for a subreddit |
| `mc:stat:<subId>:<YYYY-MM-DD>` | Hash | Daily counters — `defuses`, `claims`, `fires` |
| `mc:alerts:<subId>` | Sorted Set | Fire alerts scored by timestamp, capped at 20 |
| `mc:pat_usr:<subId>:<userId>` | Sorted Set | Sliding window for comment velocity per user |
| `mc:pat_txt:<subId>:<hash>` | Sorted Set | Sliding window for duplicate text detection |
| `mc:pat_rpt:<subId>:<postId>` | Sorted Set | Sliding window for report spike detection |
| `mc:triage:<subId>` | Sorted Set | Triage queue items scored by timestamp |
| `mc:triage_claim:<subId>:<id>` | String | Triage item claim with 5-min TTL |
| `mc:triage_defused:<subId>:<id>` | String | Defuse marker (filters item from queue) |
| `mc:triage_escalated:<subId>:<id>` | String | Escalation marker (filters item from queue) |
| `mc:audit:<subId>` | Sorted Set | Audit log scored by timestamp, capped at 50 |
| `mc:modteam:<subId>` | Hash | Per-moderator status and action counts |
| `mc:health:<subId>` | String (JSON) | Community health metrics blob |
| `mc:post_velocity:<subId>` | Sorted Set | Sliding window for post velocity detection |
| `mc:debug_mode:<subId>` | String | Debug flag — forces alerts on every post |
| `mc:debug:last_trigger:<subId>` | String | Timestamp of last PostSubmit trigger |

---

## Realtime Events

All events are broadcast on `mc_live_<sanitisedSubredditId>`.

| Event type | Sent by | Payload | Dashboard effect |
|---|---|---|---|
| `CLAIM` | `runClaim()` | `itemId`, `modName` | Refreshes claims, stats, and alerts |
| `RELEASE` | `runRelease()` | `itemId` | Refreshes claims, stats, and alerts |
| `FIRE` | `fireAlert()` | `details.alertType`, `details.*` | Refreshes alerts and stats |
| `AUDIT` | `runDefuse()` | `action`, `itemId` | Refreshes all panels |

---

## Roadmap

These are planned improvements for future iterations:

- **ML-based threat scoring** — replace heuristic scores with a lightweight classifier trained on subreddit-specific moderation history
- **Cross-subreddit threat intelligence** — allow opt-in sharing of keyword and user-velocity signals across related subreddits
- **Smart auto-moderation** — configurable rules that automatically defuse items above a confidence threshold without requiring a mod to act
- **Behavioral anomaly detection** — detect unusual account patterns (age, karma, post history) as a secondary scoring signal
- **Moderator analytics** — per-mod dashboards showing response times, action counts, and queue throughput over time
- **AI-generated moderation summaries** — end-of-day digest of what was flagged, actioned, and resolved
- **Mobile moderation alerts** — push notifications for Critical-priority triage items

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or later |
| npm | 9 or later |
| Devvit CLI | latest |
| Reddit account | Must be a moderator of the target subreddit |

---

## Installation

```bash
# Install Devvit CLI
npm install -g devvit

# Clone and install dependencies
git clone https://github.com/RobertSamuel-tech/Modcommand-Ai.git
cd Modcommand-Ai
npm install

# Authenticate with Reddit
devvit login
```

---

## Running Locally

```bash
# Start playtest — streams live logs and hot-reloads on your test subreddit
npm run dev
# Runs: devvit playtest r/<your-test-subreddit>
```

> Update the subreddit name in `package.json` to match your test subreddit before running.

Once the playtest is running:

1. Open your test subreddit
2. Use the **Create ModCommand Dashboard** menu item to create the Dashboard post
3. Submit posts with keywords like `scam`, `fraud`, `exploit`, or `zero-day` to trigger detections
4. Watch the Fire Radar and Triage Queue update in real time
5. Use the context menu on any post to test Claim, Defuse, and Release actions

**Debug mode:** Enable Debug Mode from the Dashboard footer to force a Fire Radar alert and triage entry on every post submission, regardless of content.

---

## Deploying

```bash
npm run build     # devvit build
npm run deploy    # devvit upload

# Install on your subreddit
devvit install r/yoursubreddit
```

---

## Demo

| | |
|---|---|
| **Demo Video** | _Coming soon_ |
| **Screenshots** | _Coming soon_ |
| **Architecture Diagram** | See [Architecture](#architecture) section above |

---

## Why This Matters

Reddit moderators are volunteers managing communities that can receive thousands of posts and comments per day. The tools available to them have not kept pace with the scale of the problem.

ModCommand addresses this with a platform-native solution:

- **Faster response** — automated detection fires in milliseconds on PostSubmit, not minutes after a report queue backs up
- **Reduced moderator burnout** — structured triage means mods work a prioritized queue instead of an undifferentiated flood of reports
- **Eliminated duplicate work** — the claim system ensures two mods never take the same action on the same content
- **Scalable coordination** — as mod teams grow, the shared dashboard and realtime events keep everyone working from the same operational picture
- **Built-in accountability** — the audit trail makes every action attributable and reversible, which matters when moderation decisions are disputed

---

## Built for the Reddit Devvit Hackathon

ModCommand was built to demonstrate what is possible when moderation tooling is treated as a first-class platform concern rather than an afterthought.

**What makes it a strong Devvit project:**

- **Fully Reddit-native** — no external services, no third-party infrastructure, no browser extensions. Every feature runs inside the Devvit sandbox using the platform's built-in primitives.
- **Realtime by design** — the entire coordination layer is built on Devvit's realtime channel system. The dashboard is not a polled report; it is a live operational view.
- **Practical impact** — every feature addresses a documented pain point in Reddit moderation. This is not a demo; it is a working operational tool.
- **Extensible foundation** — the state layer, trigger architecture, and triage pipeline are designed to support additional detection signals and moderation workflows without restructuring the core.

Reddit gives moderators the responsibility of maintaining healthy communities. ModCommand gives them the operational infrastructure to do it effectively.
