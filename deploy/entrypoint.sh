#!/bin/sh
set -e
# Apply pending migrations, then seed (idempotent upserts: a no-op after the first boot).
npx prisma migrate deploy
npx prisma db seed
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
