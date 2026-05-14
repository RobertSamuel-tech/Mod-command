# ModCommand

Reddit Devvit moderation app scaffold.

## Structure

```text
modcommand/
├── src/
│   ├── main.tsx
│   ├── config/
│   │   └── settings.ts
│   ├── actions/
│   │   ├── defuse.ts
│   │   ├── restore.ts
│   │   ├── claim.ts
│   │   └── release.ts
│   ├── engine/
│   │   ├── orchestrator.ts
│   │   └── reddit-api.ts
│   ├── state/
│   │   ├── redis-keys.ts
│   │   ├── claims.ts
│   │   └── patterns.ts
│   ├── realtime/
│   │   └── channels.ts
│   ├── triggers/
│   │   ├── onComment.ts
│   │   └── onReport.ts
│   └── components/
│       ├── Dashboard.tsx
│       ├── ClaimBadge.tsx
│       └── FireAlert.tsx
├── assets/
│   └── icon.png
├── devvit.yaml
├── package.json
└── README.md
```

## Develop

```sh
npm run dev
```
