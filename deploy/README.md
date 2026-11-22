# deploy/

What this repository provides to host Brick Blaster on the shared VPS. The server itself (global Caddy, shared MySQL, backups, hardening) lives in the infra repository.

| File | Role |
|---|---|
| `api.Dockerfile` | API image: Node LTS slim, non-root, `dist/` and production dependencies only |
| `web.Dockerfile` | Builds the website and exports `dist/` to a folder: no container runs for it |
| `brick-blaster.caddy` | Site block: `/` static site with SPA fallback, `/api/*` to the API, headers, cache, compression |
| `compose.yaml` | Fragment for the infra compose file: the `brick-blaster-api` service |
| `api.env.example` | Variables of the API's env file |

## Eclipse assets

`config.json`, `levels.json` and the whole `assets/` pack hold Eclipse data. They never enter the repository nor an image: `.dockerignore` only lets `apps/`, `packages/` and the npm manifests in, so the website build has no pack. Copy the pack to the server by hand (`scp -r assets/ vps:/srv/brick-blaster/pack`). Caddy serves it to browsers, and the API reads its `config.json` and `levels.json` to replay games. The images are built on the server and never pushed to a public registry. The site is not opened to the public until the pack is redone (`docs/cadrage.md`, § Assets et droits).

## Build

From the repository root, on the server (BuildKit, the default builder):

```bash
docker build -f deploy/api.Dockerfile -t brick-blaster-api .
docker build -f deploy/web.Dockerfile --output type=local,dest=/srv/brick-blaster/web .
```

The website export overwrites `index.html` and adds the new fingerprinted files; the old ones stay, so open pages keep loading their chunks. Then `docker compose up -d brick-blaster-api` from the infra repository.

## What the infra repository provides

- A shared Docker network holding Caddy and MySQL; its name goes in `INFRA_NETWORK` (default `infra`).
- `include` of `deploy/compose.yaml`, and `import` of `deploy/brick-blaster.caddy` with `BRICK_BLASTER_DOMAIN` set in Caddy's environment.
- Caddy mounts, read-only, `/srv/brick-blaster/web` and `/srv/brick-blaster/pack` at the same paths.
- Caddy's global options take the real visitor address from Cloudflare:

  ```
  servers {
  	trusted_proxies static <Cloudflare IPv4 and IPv6 ranges>
  	client_ip_headers CF-Connecting-IP
  }
  ```

  The site block then sends `{client_ip}` as the only `X-Forwarded-For` entry, and the API (`API_TRUST_PROXY=true`) rate-limits that address. A request that bypasses Cloudflare is limited on its own address.
- In MySQL: the `brick_blaster` database and a user with rights on it alone.
- A purge of the Cloudflare cache whenever the pack changes (Caddy lets it keep the pack an hour).
- Bounded logs everywhere else on the server, which this repository cannot set: a default `log-opts` (`max-size`, `max-file`) in the Docker daemon's `daemon.json` for the Caddy and MySQL containers, a retention for the host's journald, and MySQL's general and slow query logs off. No Caddy access log: it would keep visitors' addresses (the site block declares none).

## Logs

The API logs one line when a request arrives and one when it ends (method, URL, status, duration), plus errors: never the visitor's address, a request body or an email (`apps/api/src/app.ts`). URLs can still hold a game id or a pseudo (`/api/players/:pseudo`), so these are personal data and the privacy policy announces how long they stay: `SERVER_LOG_RETENTION_DAYS` in `apps/web/src/pages/legal/legalInfo.ts`, 30 days.

`compose.yaml` keeps at most 3 files of 10 MB. Docker cannot rotate by date, so the duration comes from a floor: the healthcheck calls `/api/health` every 30 seconds, about 1.4 MB of log lines a day, which pushes any line out within about 21 days even without visitors. On the first deployment, check that estimate on the server, from the infra repository (a day later, the newest file should hold about 1.4 MB):

```bash
sudo ls -l "$(dirname "$(docker inspect -f '{{.LogPath}}' "$(docker compose ps -q brick-blaster-api)")")"
```

Disabling the request logs of `/api/health`, lengthening the healthcheck interval or raising the sizes breaks that floor: change the policy along with it. Recreating the container (a new image) also deletes its logs.

## Before opening

What the GDPR audit (`docs/audits/audit-cnil.md`) could not check from this repository. Tick each one on the live services before the site opens to the public.

- [ ] Brevo: open and click tracking off (D4). On a real email, links go straight to the site and there is no tracking pixel.
- [ ] Cloudflare: SSL/TLS mode Full (strict), Always Use HTTPS, minimum TLS 1.2 (F5).
- [ ] Cloudflare: Web Analytics, Zaraz, Rocket Loader and Email Address Obfuscation off. Any cookie Cloudflare still sets (`__cf_bm`, `cf_clearance`) is added to the privacy policy (D3).
- [ ] Backups: the infra repository's lifecycle rule deletes the dumps after `BACKUP_RETENTION_DAYS` (30 days), in an EU region (C5, G2).
- [ ] `contact@brickblaster.fr` exists and is read: it is the only channel for data protection requests (`CONTACT_EMAIL`).
- [ ] DPAs of OVH, Brevo and Cloudflare accepted and archived (G5).
- [ ] `docker compose config`, from the infra repository, shows the `logging` options of `brick-blaster-api`. A day after the first deployment, the log size matches § Logs.

## Variables

`BRICK_BLASTER_HOME` (default `/srv/brick-blaster`) holds `api.env`, `pack/` and `web/`. `api.env` follows `api.env.example`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SITE_URL` (https), `BREVO_API_KEY`, `MAIL_FROM`. Keep it `chmod 600`, outside any repository. `MAIL_FROM` is a no-reply address on the site's domain, authenticated in Brevo (SPF and DKIM), never a personal address. `compose.yaml` sets `API_HOST`, `API_PORT`, `API_TRUST_PROXY` and `GAME_DATA_DIR` itself.

## Migrations

Before starting a new version of the API:

```bash
docker compose run --rm brick-blaster-api node dist/migrate.js
```

It applies the missing `apps/api/migrations/*.sql`, which the image carries, with the database of `api.env`.
