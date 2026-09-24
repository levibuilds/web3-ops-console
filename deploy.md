# Deployment

## Showcase Deployment

The public portfolio uses **Sites** and the validated [Production Snapshot](./public/production-snapshot.json). It is a static, read-only application: no VPS, SQLite writer, model key, webhook, notification, or automatic collection is needed. The built output comes from `npm run build:showcase`; `.openai/hosting.json` identifies the existing Site. The public portfolio version does not require operational deployment.

To refresh data on demand, run `npm run refresh-snapshot` locally or use the manual **Refresh operational snapshot** GitHub Action. The Action has no schedule. If its push is blocked by repository policy, download the uploaded validated snapshot artifact and review it before committing. A failed refresh preserves the prior file.

## Operational Deployment

The full Node service uses SQLite in `data/app.db`, optional provider keys, and signed webhooks. Use it only when a persistent operational backend is needed. Without keys, operational mode starts without external-source records. Demonstration records require explicit `DEMO_MODE=1` and a separate data directory. Webhooks remain disabled until their secrets are configured.

### Docker

```bash
docker build -t web3-ops-console .
docker run --rm -p 4173:4173 -e HOST=0.0.0.0 -v web3-ops-data:/app/data --env-file .env web3-ops-console
```

### Railway / Fly

Set `HOST=0.0.0.0`, use a persistent volume for `/app/data`, and configure keys and webhook secrets through the host's controlled environment settings. Start with `npm start` and expose the configured port. SQLite data must survive container restarts. Do not expose the write API without its own access controls; the public Sites version contains no operational API.
