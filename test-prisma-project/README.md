# Test Prisma Project for DevSync CLI

This is a sample Prisma project to test the DevSync CLI.

## Setup

1. Install Prisma:
```bash
cd test-prisma-project
npm install -D prisma
npm install @prisma/client
```

2. Create a PostgreSQL database (or use Supabase, Railway, etc.)

3. Set your DATABASE_URL:
```bash
# .env file
DATABASE_URL="postgresql://user:password@localhost:5432/testdb"
```

4. Run Prisma migrations:
```bash
npx prisma migrate dev --name init
```

## Test DevSync CLI

From the project root (`stacksync-copilot`):

```bash
# Build CLI first (if not already built)
cd packages/cli
npm run build

# Link globally
npm link

# Test scan (without DB)
devsync scan --path ./test-prisma-project

# Test scan (with DB)
devsync scan --path ./test-prisma-project --db postgresql://user:pass@localhost:5432/testdb
```

## What This Tests

- **Code scanning**: Should find 3 models (User, Post, Category)
- **Database scanning**: Should connect to PostgreSQL
- **Mismatch detection**: 
  - If DB is empty → will show missing tables
  - If DB has different schema → will show mismatches

## Creating Intentional Mismatches

To test the diff engine, you can:

1. Add a field to schema.prisma but not run migration:
   - Edit `prisma/schema.prisma` to add a field
   - Run `devsync scan` → should detect missing field in DB

2. Manually add a column to database:
   - Connect to DB and add a column that's not in schema.prisma
   - Run `devsync scan` → should detect extra field

3. Change a field type:
   - Change `String` to `Int` in schema.prisma (don't migrate)
   - Run `devsync scan` → should detect type mismatch

