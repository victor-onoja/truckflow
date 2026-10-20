# TruckFlow

Mobile-first gate and yard tracking for a brewery. Every truck is timed from
**Gate In → Queuing → Unlatching → Offloading → Loading → Latching → Fueling →
Gate Out**, following one of three visit types (full cycle, offload only, load
only). The server decides each truck's next step, so field staff mostly scan
and tap once.

- Product spec: [truckflow-technical-spec.md](truckflow-technical-spec.md)
- Where it's going: [docs/ROADMAP.md](docs/ROADMAP.md)
- Core rules: [lib/stage-machine.ts](lib/stage-machine.ts), [lib/stages.ts](lib/stages.ts)
- Page access by role: [lib/access.ts](lib/access.ts)

## Run locally

```bash
npm install
cp .env.example .env              # DATABASE_URL=file:./dev.db
npx prisma migrate deploy
npm run seed
NEXT_PUBLIC_DEMO_MODE=1 npm run dev   # demo mode shows the tap-to-fill demo accounts
```

Open <http://localhost:3000>. Demo logins (PIN `1234`):

| Role | Phone |
| --- | --- |
| Gate officer | 08010000001 |
| Yard operator | 08010000002 |
| Fueling staff | 08010000003 |
| Supervisor | 08010000004 |
| Distribution lead | 08010000005 |
| Admin | 08010000006 |

Reset demo data: `rm prisma/dev.db && npx prisma migrate deploy && npm run seed`.

## Tests

```bash
npm test
```

Tests run against a throwaway `prisma/test.db`, created before the run and
deleted after, so they never touch your dev data.

## Deploy (VPS)

The `deploy/` folder runs TruckFlow as a Docker service behind the VPS's shared
Caddy (no public ports; SQLite lives in the `truckflow_data` volume):

```bash
rsync -az --delete --exclude node_modules --exclude .next --exclude .git \
  --exclude 'prisma/*.db' --exclude .env ./ quantic-vps:~/truckflow/
ssh quantic-vps 'cd ~/truckflow/deploy && docker compose up -d --build'
```

`deploy/.env` on the server holds `JWT_SECRET` (required in production).
The Caddy site block is `deploy/truckflow.caddy`, installed at
`~/caddy-sites/truckflow.caddy`.

Railway (`railway.json`) also works, but set `DATABASE_URL` and `JWT_SECRET`
there, and attach a volume, or SQLite data is lost on every redeploy.
