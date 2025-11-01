# CLI Setup Guide

## Prerequisites

- Node.js 20+ installed
- npm or pnpm

## Installation

### Local Development

1. Navigate to the CLI directory:
```bash
cd packages/cli
```

2. Install dependencies:
```bash
npm install
```

3. Build the CLI:
```bash
npm run build
```

4. Link locally (for testing):
```bash
npm link
```

Now you can use `devsync` command globally:
```bash
devsync --help
```

### Development Mode

Run in development mode (uses tsx for hot reloading):
```bash
npm run dev scan --path ./your-project
```

## Testing

### Test with a Prisma Project

1. Create or use an existing project with Prisma:
```bash
# Example: if you have a project with prisma/schema.prisma
devsync scan --path ./my-prisma-project
```

2. Test with database connection:
```bash
devsync scan \
  --path ./my-prisma-project \
  --db postgresql://user:password@localhost:5432/mydb
```

### Test Init Command

```bash
# Initialize in a project
cd ./my-project
devsync init

# This creates .devsync/config.json
# Edit it with your database connection string
```

## Troubleshooting

### Build Errors

If you get TypeScript errors:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Module Resolution Issues

If you get "Cannot find module" errors, ensure:
- You're using ES modules (type: "module" in package.json)
- Import paths use `.js` extension
- TypeScript config is correct

### Database Connection Issues

Common connection string formats:
```bash
# PostgreSQL
postgresql://user:password@localhost:5432/dbname

# With SSL (Supabase, etc.)
postgresql://user:password@host:5432/dbname?sslmode=require
```

### Prisma Schema Not Found

Make sure your project has:
- `prisma/schema.prisma` file
- Valid Prisma syntax

## Next Steps

1. Test with your own Prisma project
2. Report any bugs or issues
3. See main README.md for usage examples

