# Friday — Voice UI

Premium React + Vite voice interface for the Friday n8n command layer.

## Run locally

Requirements:
- Node.js 18+
- npm

Install and start:

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Webhook

The UI sends POST requests to the Friday n8n webhook.

Default:

`https://akpackfitness.app.n8n.cloud/webhook/friday-core`

To override it locally, create `.env.local`:

```env
VITE_N8N_WEBHOOK_URL=https://your-n8n-host/webhook/friday-core
```

The browser sends:
- `source`
- `message`
- `sessionId`
- `inputMode` (`text` or `voice`)

The UI accepts common n8n response shapes including `reply.text`, `reply`, `output`, and `text`.

## Deployment

The previous `.github/workflows/static.yml` workflow has intentionally been removed. Deployment can be configured separately when the final hosting method is selected.
