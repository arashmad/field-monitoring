# PostgreSQL + PostGIS + Drizzle ORM

## Directory Structure

/db
  /migrations -> contain migration files
  /schemas -> contains tables and models definition
  client.ts -> responsible for creating pool connection


## Database Management
```bash
cd /to/the/repository/field-monitoring-ui
```

### Test
```bash
pnpm test:db
```

### Check
```bash
pnpm db:check
```

### Generate migration file
```bash
pnpm db:generate
```

> [!TIP]
> To re-generate a migration file, you need to ... tbd

### Migrate
```bash
pnpm db:migrate
```
tbd

  