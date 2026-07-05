# Deployment

This app is a single Node service with SQLite storage in `data/app.db`.

## Docker

```bash
docker build -t web3-info-monitor-agent .
docker run --rm -p 4173:4173 -v web3-agent-data:/app/data --env-file .env web3-info-monitor-agent
```

Open:

```text
http://localhost:4173
```

## Railway

1. Push the repository to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add a persistent volume mounted at `/app/data`.
4. Add environment variables from `.env.example`.
5. Set the start command to:

```bash
npm start
```

6. Expose port `4173`.

## Fly.io

1. Install and sign in:

```bash
fly auth login
```

2. Launch from the repository:

```bash
fly launch
```

3. Create a volume for SQLite:

```bash
fly volumes create web3_agent_data --size 1
```

4. In `fly.toml`, mount the volume:

```toml
[mounts]
  source = "web3_agent_data"
  destination = "/app/data"
```

5. Set secrets:

```bash
fly secrets set COINGECKO_API_KEY=... X_BEARER_TOKEN=... ETHERSCAN_API_KEY=...
```

6. Deploy:

```bash
fly deploy
```

## Notes

- SQLite must live on a persistent volume in production.
- Without API keys, the app clearly displays demo mode.
- Data is for research only and does not constitute investment advice.
