# Field Monitoring

Next.js foundation for managing agricultural Fields and monitoring vegetation
with Sentinel-2 data. See [the project plan](docs/PLAN.md) for the MVP scope,
architecture boundaries, and M1–M10 roadmap.

> [!NOTE]
> This document assumes that you are using **Linux Ubuntu 24.04** as the OS.

## Getting started

### 1. Requirement

1. node `v24.11.0`.
2. pnpm `v11.5.2`.
3. docker

> [!TIP]
> Using nvm (node version manager) is very helpful.

### 2. Build the infrastructure

#### 2.1 Create the environments

For the local deployment, create the `.env` file first
```bash
cd /to/the/repository/field-monitoring-ui
cp .env.example .env
```
The example contains local development credentials. These `POSTGRES_*`
variables configure Docker Compose, the database client, and Drizzle Kit.
Keep `.env` untracked. No production credentials are needed.

#### 2.2 Install packages

```bash
pnpm install
```

#### 2.3 Start and initialize the database

```bash
docker compose up -d --wait
pnpm db:check
pnpm db:migrate
pnpm test:db
```
The committed baseline enables PostGIS. The integration tests verify both
PostgreSQL connectivity and `PostGIS_Version()`. See [database setup and
migrations](db/README.md) for the workflow and connection troubleshooting.

### 3. Configure authentication

Add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` from `.env.example` to your ignored
`.env`. Generate a private secret and provision your first account using the
instructions in [authentication setup](docs/AUTHENTICATION.md). Public sign-up is
disabled. Sign in at `/sign-in` to access `/app`.

```bash
pnpm auth:create-user --email grower@example.com --name "Grower"
```

The command prompts for a hidden password. Sessions expire after seven days and
renew daily while used; sign-out revokes the current device's session.

### 4. Test the application

Jest unit tests live in `tests/unit/`; database integration tests live in
`tests/integration/`; Playwright tests live in `tests/e2e/`.
Install the browser binaries and Linux system dependencies before the first E2E
run (the system dependency installation may request sudo):

```bash
pnpm exec playwright install --with-deps
```

```bash
cd /to/the/repository/field-monitoring-ui
pnpm lint # code style test
pnpm test:typecheck # type checking test
pnpm test # unit test (jest)
pnpm test:auth # real authentication/session tests (requires migrated PostgreSQL)
pnpm test:e2e # e2e test (playwright)
pnpm test:e2e:ui # interactive browser test runner
```

Playwright starts a dedicated development server at `http://127.0.0.1:3100`
with a matching auth origin. E2E tests require migrated PostgreSQL and auth
configuration, and run in Chromium, Firefox, and
WebKit. To run a single browser: `pnpm test:e2e --project=chromium`.
Use `pnpm exec playwright show-report` to inspect the generated HTML report.

Database work requires the variables in `.env.example` and a running PostgreSQL
instance. Run `pnpm test:db` separately from the UI unit tests (`pnpm test`).

### 5. Run the app

The application is started locally on `:3000` by default. 

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

#### 5.1 Run in development
To start the server you need to do
```bash
cd /to/the/repository/field-monitoring-ui
pnpm dev
```

#### 5.2 Serve the app

```bash
pnpm build
pnpm start
```
