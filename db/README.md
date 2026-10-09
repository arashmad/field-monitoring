# PostgreSQL, PostGIS, and Drizzle

Run all commands from the `field-monitoring-ui` directory.

## Local setup

```bash
cp .env.example .env
pnpm install
docker compose up -d --wait
pnpm db:check
pnpm db:migrate
pnpm test:db
```

Copy the example only when creating `.env`; preserve an existing configuration.
The example contains development credentials, not production credentials.
Docker Compose uses `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and
`POSTGRES_PORT`. The app and Drizzle Kit also use `POSTGRES_HOST`. No separate
`DATABASE_URL` is required.

Use `localhost` when Next.js runs on the host. If it runs in the same Compose
network, use `postgis` and the container port `5432` instead. If you change the
host port, update `POSTGRES_PORT` for host-based connections.

## Repository structure

```text
drizzle.config.ts   Drizzle Kit configuration; loads the Next.js environment
db/
  client.ts        Server-only pooled connection used by the app
  schemas/
    index.ts       Schema entry point; re-exports auth.ts and farm.ts
    auth.ts        Better Auth users, accounts, sessions and verification
    farm.ts        Owner-scoped Farms
  migrations/
    <timestamp>_enable_postgis/
      migration.sql
      snapshot.json
```

The initial custom migration runs `CREATE EXTENSION IF NOT EXISTS postgis`.
It works whether the Docker image has already enabled PostGIS or the target
database has no extension yet. The target PostgreSQL server must have PostGIS
installed, and the migration user must have permission to enable it. The
authentication migration adds Better Auth tables and cascading user ownership
links. The Farm migration adds an owner-scoped Farm table; Field tables are future
work. See
[authentication setup](../docs/AUTHENTICATION.md) for account provisioning.

## Migration workflow

`pnpm db:check` checks the committed migration history for consistency; it is
not a database connectivity or schema-drift check.

When adding application tables, define and export them in `db/schemas/index.ts`
(or re-export them there from other schema files), then run:

```bash
pnpm db:generate --name=describe_change
pnpm db:check
pnpm db:migrate
```

Review the generated SQL and commit the entire migration directory, including
its snapshot. With no schema changes, `db:generate` should produce no new
migration. Generating migrations does not apply them to PostgreSQL.

For changes outside Drizzle's table schema, such as extensions, generate a
custom migration and fill in its SQL before applying it:

```bash
pnpm db:generate --custom --name=describe_change
```

`pnpm db:migrate` applies pending committed migrations and records their history
in `drizzle.__drizzle_migrations`. Running it again leaves applied migrations
unchanged. Run migrations as a setup/deployment step, not inside request handlers.
Keep applied migrations immutable; create a new migration for later changes.

## Verification and troubleshooting

```bash
pnpm test:db
```

The tests use the real `db/client.ts` connection. They run `SELECT 1`, verify
`current_database()` against `POSTGRES_DB`, and call `PostGIS_Version()`.
They do not create application tables or insert data. Jest loads `.env` through
`next/jest`; `.env.test` takes precedence if present, and `.env.local` is not
loaded in the test environment.

A refused connection usually means PostgreSQL is stopped or the host/port is
incorrect. For authentication errors, check the credentials used when the
Docker volume was first initialized: changing `.env` does not change the user
or password in an existing database volume. A missing `PostGIS_Version()` means
PostGIS is not enabled in the selected database; apply the baseline migration.

`docker compose down` stops the database and preserves the named data volume.
Avoid `docker compose down -v` unless you intend to delete the local database.
