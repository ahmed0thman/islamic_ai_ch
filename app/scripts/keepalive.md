# Keep-alive for the free Render service

Render's free web service sleeps after 15 minutes without requests, with a cold start of
about a minute. Decision 125 requires hosting that does not sleep, so the service is pinged
every 10 minutes on its health endpoint, `GET /api/health/` (the app uses `trailingSlash`,
so the path ends with a slash).

## Option: a GitHub Actions schedule

`.github/workflows/keepalive.yml` (repository root) pings the endpoint every 10 minutes
(`cron: "*/10 * * * *"`) with `curl -fsS "$HUDA_URL/api/health/"`.

To register it, the owner:

1. Adds the secret `HUDA_URL` (the Render service URL, e.g. `https://huda.onrender.com`) in
   the GitHub repository under Settings > Secrets and variables > Actions.
2. Enables the workflow on the Actions tab if GitHub has it disabled for the repository.

Notes:

- GitHub Actions schedules are not exact: runs may start late and occasionally skip. A late
  ping still wakes the service, but the 15-minute sleep window can be crossed.
- `/api/health/` answers HTTP 200 with `{ "ok": true, "db": <boolean>, "embed": "off" }`
  even when the database is unreachable (`db: false`), so a database problem never silences
  the keep-alive ping.
- Render's free tier gives 750 instance hours per month, enough for a service awake all month.

The owner decides whether to enable this workflow or to point another free external ping
service at `/api/health/` every 10 minutes instead.
