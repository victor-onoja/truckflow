import { execSync } from 'child_process';
import { rmSync } from 'fs';
import path from 'path';

// Tests run against their own throwaway SQLite file so they never touch dev.db.
export const TEST_DATABASE_URL = 'file:./test.db';
const dbFile = path.resolve(__dirname, '../prisma/test.db');

function removeDb() {
  for (const f of [dbFile, `${dbFile}-journal`]) rmSync(f, { force: true });
}

export function setup() {
  removeDb();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'ignore',
  });
}

export function teardown() {
  removeDb();
}
