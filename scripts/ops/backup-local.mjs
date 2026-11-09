#!/usr/bin/env node
// Local backup of the whole database: every table as gzipped NDJSON, plus a manifest with row counts
// and SHA-256 hashes. Read only: one REPEATABLE READ, READ ONLY transaction, so every table comes from
// the same snapshot even when the scheduled ingest writes during the backup.
//
// Why: Neon's free plan can restore only the last 6 hours, and the nightly snapshot on the `data`
// branch holds only what the public API serves. Verdict history, withheld evidence, admin overrides,
// corrections and the audit log exist nowhere else.
//
// Usage: npm run backup:local [-- <out-dir>]
//   DATABASE_URL comes from the environment or from .env.local in the repo root.
//   Default output: ~/stp-backups/<UTC stamp>/ (outside the repo, never committed, mode 700).
// The backup holds source data whose terms do not allow re-serving. Keep it private.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { Pool } from "@neondatabase/serverless";

for (const f of [".env.local", ".env"]) {
  if (!process.env.DATABASE_URL && existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      // unreadable env file: fall through to the check below
    }
  }
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("backup-local: DATABASE_URL is not set (environment or .env.local). Nothing backed up.");
  process.exit(2);
}

const PAGE = 2000;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
const out = path.resolve(process.argv[2] ?? path.join(os.homedir(), "stp-backups", stamp));
const repo = process.cwd();
if (out === repo || out.startsWith(repo + path.sep)) {
  console.error("backup-local: the output folder is inside the repo. Choose a folder outside it so a backup can never be committed.");
  process.exit(2);
}
await mkdir(out, { recursive: true });
await chmod(out, 0o700);

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;
const pool = new Pool({ connectionString: url, max: 1 });
const db = await pool.connect();
const manifest = { takenAt: new Date().toISOString(), format: "one gzipped NDJSON file per table, all tables read from one database snapshot", tables: {} };
let total = 0;
let tableCount = 0;
try {
  await db.query("begin transaction isolation level repeatable read read only");
  const { rows: tables } = await db.query(
    "select table_schema as schema, table_name as name from information_schema.tables where table_type = 'BASE TABLE' and table_schema in ('public', 'drizzle') order by 1, 2",
  );
  if (tables.length === 0) throw new Error("the database lists no tables");
  tableCount = tables.length;
  for (const t of tables) {
    const from = `${ident(t.schema)}.${ident(t.name)}`;
    const lines = [];
    // A cursor inside the transaction reads the table once, in pages, from the same snapshot.
    await db.query(`declare stp_backup no scroll cursor for select * from ${from}`);
    for (;;) {
      const { rows } = await db.query(`fetch ${PAGE} from stp_backup`);
      for (const r of rows) lines.push(JSON.stringify(r));
      if (rows.length < PAGE) break;
    }
    await db.query("close stp_backup");
    const { rows: [{ n }] } = await db.query(`select count(*)::int as n from ${from}`);
    if (n !== lines.length) throw new Error(`${t.schema}.${t.name}: read ${lines.length} rows but the snapshot holds ${n}`);
    const text = lines.length ? `${lines.join("\n")}\n` : "";
    const file = `${t.schema}.${t.name}.ndjson.gz`;
    const gz = gzipSync(text);
    await writeFile(path.join(out, file), gz, { mode: 0o600 });
    manifest.tables[`${t.schema}.${t.name}`] = { file, rows: lines.length, sha256: createHash("sha256").update(text).digest("hex"), bytes: gz.length };
    total += gz.length;
    console.log(`${String(lines.length).padStart(8)} rows  ${file}`);
  }
  await db.query("commit");
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error(`backup-local: failed, the backup in ${out} is incomplete. ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
if (process.exitCode) process.exit(process.exitCode);
await writeFile(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(`\nBackup written to ${out} (${tableCount} tables, ${(total / 1024 / 1024).toFixed(2)} MB). Keep it private.`);
