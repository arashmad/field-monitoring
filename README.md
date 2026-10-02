# Field Monitoring
> description

> [!INFO]
> This document assumes that you are using **Linux Ubuntu 24.04** as the OS.

## Getting started

### 1. Requirement

1. node `v24.11.0`.
2. pnpm `v11.5.2`.

> [!TIP]
> Using nvm (node version manager) is very helpful.

### 2. Install the application

```bash
cd /to/the/repository/field-monitoring-ui
pnpm install
```

### 2. Test the application
```bash
cd /to/the/repository/field-monitoring-ui
pnpm lint # code style test
pnpm test:typecheck # type checking test
pnpm test # unit test (jest)
pnpm test:e2e # e2e test (playwright)
```

### 2. Run the app

The application is started locally on `:3000` by default. 

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

#### 2.1 Run in development
To start the server you need to do
```bash
cd /to/the/repository/field-monitoring-ui
pnpm dev
```

#### 2.2 Serve the app
?