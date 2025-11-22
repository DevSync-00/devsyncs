# DevSync CLI

AI-powered schema sync for modern development.

## Installation

```bash
npm install -g @devsync/cli
```

Or use locally:

```bash
npm install @devsync/cli
npx devsync scan
```

## Quick Start

### 1. Initialize Project

```bash
devsync init
```

This creates a `.devsync/config.json` file in your project.

### 2. Scan for Mismatches

```bash
# Scan with inline database connection
devsync scan --db postgresql://user:password@localhost:5432/mydb

# Or scan without DB (just show code models)
devsync scan

# Use config file for database connection
devsync scan --config .devsync/config.json
```

## Commands

### `devsync init`

Initialize DevSync in your project. Creates `.devsync/config.json`.

### `devsync scan`

Scan your codebase and database for schema mismatches.

**Options:**
- `-p, --path <path>` - Codebase path (default: current directory)
- `-d, --db <connection>` - Database connection string
- `--config <path>` - Config file path (default: `.devsync/config.json`)

**Examples:**
```bash
# Scan current directory
devsync scan

# Scan specific project
devsync scan --path ./my-project

# Scan with database connection
devsync scan --db postgresql://user:pass@localhost/dbname

# Use config file
devsync scan --config .devsync/config.json

# Works with any supported schema type (Prisma, TypeORM, Sequelize, Drizzle, Raw SQL)
# DevSync automatically detects your schema type!
```

## Configuration

Edit `.devsync/config.json`:

```json
{
  "version": "1.0",
  "project": {
    "name": "my-project",
    "schemaType": "prisma"
  },
  "database": {
    "connectionString": "postgresql://user:password@localhost:5432/mydb",
    "provider": "postgresql"
  },
  "scan": {
    "watch": false,
    "autoFix": false
  }
}
```

## Supported Schema Types

Currently supported:
- ✅ **Prisma** (`prisma/schema.prisma`)
- ✅ **Supabase** (`supabase/migrations/*.sql`) - Most important!
- ✅ **TypeORM** (`*.entity.ts`)
- ✅ **Kysely** (`schema.ts` or SQL template literals)
- ✅ **Sequelize** (`*.model.js/ts`)
- ✅ **Drizzle ORM** (`schema.ts`)
- ✅ **Django** (`models.py`)
- ✅ **SQLAlchemy** (`*.py` with SQLAlchemy models)
- ✅ **Raw SQL** (`*.sql` migration files)

DevSync automatically detects which schema type you're using!

## Database Support

Currently supported:
- ✅ PostgreSQL

Coming soon:
- ⏳ MySQL
- ⏳ SQLite

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Watch mode
npm run watch
```

## License

MIT

