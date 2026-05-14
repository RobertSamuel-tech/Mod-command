# ModCommand

A Reddit [Devvit](https://developers.reddit.com/docs) moderation app that gives mod teams a real-time command centre inside Reddit. It surfaces a live Dashboard custom post with active claim tracking, a Fire Radar that detects spam waves, report spikes, copypasta brigades, and keyword-flagged posts, plus per-moderator action shortcuts (Defuse, Claim, Release).

---

## Table of Contents

- [Features](#features)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Deploying](#deploying)
- [Workflow](#workflow)
- [Architecture](#architecture)
- [Redis Key Reference](#redis-key-reference)
- [Realtime Events](#realtime-events)

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Custom post that shows active claims, Fire Radar alerts, and today's stats live |
| **Defuse** | Context-menu action — removes and locks a post or comment in one click |
| **Claim** | Marks a post/comment as being handled by the current mod (5-minute TTL) |
| **Release** | Removes a claim so another mod can pick it up |
| **Fire Radar** | Automatic detection of spam waves, report spikes, copypasta brigades, and keyword-flagged posts |
| **Realtime sync** | All Dashboard instances update instantly via Devvit Realtime channels |
| **Daily stats** | Tracks defuse, claim, and fire counts per subreddit per day |

---

## Folder Structure

```
modcommand/
├── src/
│   ├── main.tsx                  # App entry point — configures Devvit, registers all triggers, menu items, and the custom post type
│   │
│   ├── actions/                  # Mod actions invoked from context menus
│   │   ├── defuse.ts             # Removes + locks a post or comment, increments defuse stat
│   │   ├── claim.ts              # Claims a post/comment for 5 min, broadcasts CLAIM event
│   │   ├── release.ts            # Releases a claim, broadcasts RELEASE event
│   │   └── restore.ts            # (scaffold) Restore/approve a removed item
│   │
│   ├── components/               # Devvit Blocks UI components
│   │   ├── Dashboard.tsx         # Main custom post — live claims, Fire Radar, today's stats
│   │   ├── ClaimBadge.tsx        # Renders a single active claim row
│   │   └── FireAlert.tsx         # Renders a single fire alert row
│   │
│   ├── config/
│   │   └── settings.ts           # App-level configuration constants (scaffold)
│   │
│   ├── engine/
│   │   ├── orchestrator.ts       # (scaffold) Central mod-action orchestration logic
│   │   └── reddit-api.ts         # (scaffold) Reddit API helpers
│   │
│   ├── realtime/
│   │   └── channels.ts           # Channel name builder + RTMessage type definition
│   │
│   ├── state/                    # All Redis read/write logic
│   │   ├── redis-keys.ts         # Centralised key name builders (mc:claim:…, mc:stat:…, etc.)
│   │   ├── claims.ts             # setClaim / getClaim / releaseClaim / listActiveClaims
│   │   ├── fire-alerts.ts        # fireAlert() — records alert, increments stat, broadcasts FIRE
│   │   ├── patterns.ts           # Sliding-window detectors: velocity, duplicate text, report spike; alert list read/write
│   │   └── stats.ts              # incrementStat / getTodayStats
│   │
│   └── triggers/                 # Devvit server-side event handlers
│       ├── onPost.ts             # PostSubmit — keyword scan on title + selftext → fireAlert
│       ├── onComment.ts          # CommentSubmit — spam-wave and copypasta-brigade detection
│       └── onReport.ts           # PostReport / CommentReport — report-spike detection
│
├── assets/
│   └── icon.png                  # App icon shown in the Devvit app directory
│
├── devvit.yaml                   # App name, version, and Reddit API permission declarations
├── package.json                  # Dependencies and npm scripts
└── README.md
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or later |
| npm | 9 or later |
| Devvit CLI | latest (`npm i -g devvit`) |
| Reddit account | Must be a mod of a test subreddit |

Install the Devvit CLI globally if you haven't already:

```sh
npm install -g devvit
```

Log in with your Reddit account:

```sh
devvit login
```

---

## Installation

```sh
git clone https://github.com/RobertSamuel-tech/Modcommand-Ai.git
cd Modcommand-Ai
npm install
```

---

## Running Locally

Playtest streams live logs directly to your terminal and hot-reloads the app on your test subreddit.

```sh
npm run dev
# Runs: devvit playtest r/modcommandtest
```

> Change `r/modcommandtest` in `package.json` to your own test subreddit.

Once running:

1. Open your test subreddit.
2. Use the **Create ModCommand Dashboard** subreddit menu item to create the Dashboard post.
3. Create posts or comments to trigger detection rules.
4. Watch the Dashboard update in real time.

---

## Deploying

Build and upload to the Devvit app directory:

```sh
npm run build    # devvit build
npm run deploy   # devvit upload
```

Then install the app on your subreddit via the Devvit developer portal or with:

```sh
devvit install r/yoursubreddit
```

---

## Workflow

### Moderator actions (context menu)

```
Mod right-clicks a post or comment
        │
        ├─ ⚡ Defuse   → removes item, locks it, increments defuse stat
        │
        ├─ Claim       → marks item as in-progress (5-min TTL), broadcasts CLAIM
        │                Dashboard shows the claim badge in real time
        │
        └─ Release     → clears the claim, broadcasts RELEASE
                         Dashboard removes the badge in real time
```

### Automatic Fire Radar

```
New post submitted (PostSubmit)
        │
        └─ onPost.ts scans title + selftext for keywords
           (fraud, lawsuit, exposed, scam, illegal, banned, …)
                │
                └─ keyword found → fireAlert()

New comment submitted (CommentSubmit)
        │
        ├─ checkUserVelocity()   — ≥ 5 comments from same user in 10 min
        │       └─ triggered → fireAlert(spam_wave)
        │
        └─ checkDuplicateText()  — same comment body posted ≥ 3 times in 5 min
                └─ triggered → fireAlert(copypasta_brigade)

Post or comment reported (PostReport / CommentReport)
        │
        └─ checkReportSpike()    — ≥ 3 reports on same item in 10 min
                └─ triggered → fireAlert(report_spike)
```

### fireAlert() internals

```
fireAlert(ctx, subredditId, type, details)
        │
        ├─ recordAlert()       → writes JSON entry to Redis sorted set (mc:alerts:<subId>)
        ├─ incrementStat()     → increments fires field in Redis hash (mc:stat:<subId>:<date>)
        └─ realtime.send()     → publishes { type: 'FIRE', details } to mc_live_<subId>
```

### Dashboard real-time update cycle

```
Dashboard open
        │
        ├─ Initial render   → loads claims, stats, alerts from Redis
        │
        ├─ useChannel       → subscribes to mc_live_<subredditId>
        │       CLAIM / RELEASE → refreshAll()   (claims + stats + alerts)
        │       FIRE            → refreshAlerts() (alerts + stats)
        │
        ├─ useInterval 5 s  → refreshAlerts()   (alerts + stats)
        └─ useInterval 30 s → refreshAll()      (claims + stats + alerts)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Reddit Platform                       │
│                                                         │
│  PostSubmit ──► onPost.ts ─────────────────────────┐    │
│  CommentSubmit ► onComment.ts ──────────────────┐  │    │
│  PostReport ───► onReport.ts ───────────────┐   │  │    │
│  CommentReport ► onReport.ts ───────────────┘   │  │    │
│                                                 │  │    │
│              fireAlert()  ◄─────────────────────┘  │    │
│                  │                              │        │
│        ┌─────────┼──────────┐             runClaim()     │
│        │         │          │             runRelease()    │
│     Redis      Redis     Realtime              │         │
│   (alert list)(stats)   channel               │         │
│                            │                  │         │
│                      mc_live_<subId>           │         │
│                            │                  │         │
│              ┌─────────────┴──────────────────┘         │
│              │                                          │
│         Dashboard.tsx (custom post)                     │
│           useChannel + useInterval                      │
│           ├─ Active Claims                              │
│           ├─ 🔥 Fire Radar                              │
│           └─ Today's Stats                              │
└─────────────────────────────────────────────────────────┘
```

---

## Redis Key Reference

| Key pattern | Type | Purpose |
|---|---|---|
| `mc:claim:<subId>:<itemId>` | String (JSON) | Active claim record with TTL |
| `mc:claims:<subId>` | Hash | Index of all claims for a subreddit |
| `mc:stat:<subId>:<YYYY-MM-DD>` | Hash | Daily counters — `defuses`, `claims`, `fires` |
| `mc:alerts:<subId>` | Sorted Set | Fire alerts scored by timestamp, capped at 20 |
| `mc:pat_usr:<subId>:<userId>` | Sorted Set | Sliding window for comment velocity per user |
| `mc:pat_txt:<subId>:<hash>` | Sorted Set | Sliding window for duplicate text detection |
| `mc:pat_rpt:<subId>:<postId>` | Sorted Set | Sliding window for report spike detection |

---

## Realtime Events

All events are published on the channel `mc_live_<sanitisedSubredditId>`.

| `type` | Sent by | Payload fields | Dashboard action |
|---|---|---|---|
| `CLAIM` | `runClaim()` | `itemId`, `modName` | `refreshAll()` |
| `RELEASE` | `runRelease()` | `itemId` | `refreshAll()` |
| `FIRE` | `fireAlert()` | `details.alertType`, `details.*` | `refreshAlerts()` |
