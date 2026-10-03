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
and then fill the variables.

#### 2.2 Start the database

```bash
docker compose up --build
```
to check the database connection, you need to do
```
pnpm test:db
```
For maintaining the database, check [this document](../field-monitoring-ui/db/README.md).

#### 2.3 Install packages

```bash
cd /to/the/repository/field-monitoring-ui
pnpm install
```

### 3. Test the application

Jest tests live in `tests/unit/`; Playwright tests live in `tests/e2e/`.
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
pnpm test:e2e # e2e test (playwright)
pnpm test:e2e:ui # interactive browser test runner
```

Playwright starts the local development server at `http://127.0.0.1:3000`
automatically, or reuses it outside CI. E2E tests run in Chromium, Firefox, and
WebKit. To run a single browser: `pnpm test:e2e --project=chromium`.
Use `pnpm exec playwright show-report` to inspect the generated HTML report.

No environment variables are required for the current application; `.env.example`
records this. Database, authentication, and processing setup will be documented
when those features are introduced.

### 4. Run the app

The application is started locally on `:3000` by default. 

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

#### 4.1 Run in development
To start the server you need to do
```bash
cd /to/the/repository/field-monitoring-ui
pnpm dev
```

#### 4.2 Serve the app

```bash
pnpm build
pnpm start
```
