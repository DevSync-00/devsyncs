# 🚀 DevSync.AI — Quick Start Guide

> Get started building DevSync.AI from MVP to Production

---

## 📋 Overview

This guide helps you **decide what to build first** and **get started quickly** with the right setup for your timeline.

---

## 🎯 Choose Your Path

### Path 1: Proof of Concept (2 weeks)
**Goal**: Validate the concept works locally
- ✅ Build Phase 1: CLI MVP
- ✅ No infrastructure needed
- ✅ Works 100% offline

**Outcome**: Working `devsync scan` command that shows schema mismatches

---

### Path 2: MVP with Dashboard (6 weeks)
**Goal**: Share results with team via web dashboard
- ✅ Build Phases 1–3: CLI + Dashboard + Migrations
- ✅ Minimal infrastructure (Supabase + Vercel)
- ✅ Cost: ~$0–15/month

**Outcome**: Full MVP ready for early users

---

### Path 3: Beta Product (6 months)
**Goal**: Production-ready beta with AI and integrations
- ✅ Build Phases 1–7: Full feature set
- ✅ Production infrastructure
- ✅ Cost: ~$100–300/month

**Outcome**: Beta product ready for 100–500 users

---

## 🛠️ Setup Instructions

### Prerequisites

```bash
# Required
- Node.js 20+ installed
- npm or pnpm
- Git

# Optional (for Phase 2+)
- Supabase account (free)
- Vercel account (free)
- OpenAI API key (for Phase 6+)
```

---

## 🚀 Phase 1: CLI MVP (2 weeks)

### Step 1: Create CLI Package Structure

```bash
# Create new directory for CLI
mkdir devsync-cli
cd devsync-cli
npm init -y

# Install dependencies
npm install commander dotenv pg @prisma/client
npm install -D typescript @types/node @types/pg tsx

# Create basic structure
mkdir -p src/{commands,services,utils}
touch src/index.ts
touch src/commands/scan.ts
```

### Step 2: Basic CLI Setup

**`package.json`**:
```json
{
  "name": "devsync",
  "version": "0.1.0",
  "bin": {
    "devsync": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  }
}
```

**`src/index.ts`**:
```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { scanCommand } from './commands/scan';

program
  .name('devsync')
  .description('AI-powered schema sync for modern development')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan codebase and database for mismatches')
  .option('-p, --path <path>', 'Codebase path', process.cwd())
  .option('-d, --db <connection>', 'Database connection string')
  .action(scanCommand);

program.parse();
```

### Step 3: Core Scan Logic

**`src/commands/scan.ts`**:
```typescript
import { scanCodebase } from '../services/code-scanner';
import { scanDatabase } from '../services/db-scanner';
import { compareSchemas } from '../services/diff-engine';

export async function scanCommand(options: { path: string; db?: string }) {
  console.log('🔍 Scanning codebase and database...\n');

  // 1. Scan codebase (extract Prisma schema)
  const codeSchema = await scanCodebase(options.path);
  console.log('✅ Code schema extracted');

  // 2. Scan database (if connection provided)
  if (!options.db) {
    console.log('⚠️  No database connection provided');
    console.log('💡 Tip: Use --db flag to compare with database');
    return;
  }

  const dbSchema = await scanDatabase(options.db);
  console.log('✅ Database schema extracted');

  // 3. Compare schemas
  const diff = compareSchemas(codeSchema, dbSchema);
  console.log('\n📊 Results:\n');
  
  if (diff.mismatches.length === 0) {
    console.log('✨ No mismatches found! Everything is in sync.');
  } else {
    console.log(`⚠️  Found ${diff.mismatches.length} mismatch(es):\n`);
    diff.mismatches.forEach((mismatch, i) => {
      console.log(`${i + 1}. ${mismatch.type}: ${mismatch.model}.${mismatch.field}`);
      console.log(`   Code: ${mismatch.codeValue}`);
      console.log(`   DB:   ${mismatch.dbValue}\n`);
    });
  }
}
```

### Step 4: Implement Core Services

**`src/services/code-scanner.ts`**:
```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

export async function scanCodebase(basePath: string) {
  // Look for schema.prisma
  const schemaPath = join(basePath, 'prisma', 'schema.prisma');
  
  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    // Parse Prisma schema (simplified example)
    const models = parsePrismaSchema(schemaContent);
    return { models, type: 'prisma' };
  } catch (error) {
    throw new Error(`Could not find Prisma schema at ${schemaPath}`);
  }
}

function parsePrismaSchema(content: string) {
  // Simplified parser - use @prisma/client or proper parser in production
  const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
  const models: any[] = [];
  
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const [, modelName, fieldsContent] = match;
    const fields = parseFields(fieldsContent);
    models.push({ name: modelName, fields });
  }
  
  return models;
}

function parseFields(content: string) {
  // Extract field definitions (simplified)
  const fieldRegex = /(\w+)\s+(\w+)([^\n]*)/g;
  const fields: any[] = [];
  
  let match;
  while ((match = fieldRegex.exec(content)) !== null) {
    const [, name, type] = match;
    fields.push({ name, type });
  }
  
  return fields;
}
```

**`src/services/db-scanner.ts`**:
```typescript
import { Client } from 'pg';

export async function scanDatabase(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Query PostgreSQL system tables for schema
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const models = await Promise.all(
      tables.rows.map(async (table) => {
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
        `, [table.table_name]);

        return {
          name: table.table_name,
          fields: columns.rows.map(col => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES'
          }))
        };
      })
    );

    return { models, type: 'postgresql' };
  } finally {
    await client.end();
  }
}
```

**`src/services/diff-engine.ts`**:
```typescript
export function compareSchemas(codeSchema: any, dbSchema: any) {
  const mismatches: any[] = [];

  // Find models in code that aren't in DB
  codeSchema.models.forEach((codeModel: any) => {
    const dbModel = dbSchema.models.find((m: any) => m.name === codeModel.name);
    
    if (!dbModel) {
      mismatches.push({
        type: 'missing_table',
        model: codeModel.name,
        severity: 'error'
      });
      return;
    }

    // Compare fields
    codeModel.fields.forEach((codeField: any) => {
      const dbField = dbModel.fields.find((f: any) => f.name === codeField.name);
      
      if (!dbField) {
        mismatches.push({
          type: 'missing_field',
          model: codeModel.name,
          field: codeField.name,
          codeValue: codeField.type,
          severity: 'error'
        });
      } else if (codeField.type !== dbField.type) {
        mismatches.push({
          type: 'type_mismatch',
          model: codeModel.name,
          field: codeField.name,
          codeValue: codeField.type,
          dbValue: dbField.type,
          severity: 'warning'
        });
      }
    });
  });

  return { mismatches };
}
```

### Step 5: Test Locally

```bash
# Build
npm run build

# Link locally
npm link

# Test
devsync scan --path ./my-project --db postgresql://user:pass@localhost/db
```

---

## 🌐 Phase 2: Dashboard Setup (Weeks 3–6)

### Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Run database migrations (from `ARCHITECTURE.md`)
4. Get API keys:
   - Project URL
   - Anon key
   - Service role key

### Step 2: Next.js Setup

```bash
# In your main project (stacksync-copilot)
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @supabase/auth-ui-react @supabase/auth-ui-shared

# Create .env.local
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### Step 3: Add Dashboard Pages

```typescript
// src/pages/dashboard/Projects.tsx
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase
        .from('projects')
        .select('*');
      setProjects(data || []);
    }
    loadProjects();
  }, []);

  return (
    <div>
      <h1>Projects</h1>
      {projects.map(project => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
}
```

### Step 4: Connect CLI to Cloud

```typescript
// src/services/api-client.ts
export async function sendScanReport(projectId: string, report: any) {
  const response = await fetch('https://api.devsync.ai/v1/scans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEVSYNC_API_KEY}`
    },
    body: JSON.stringify({ projectId, ...report })
  });
  return response.json();
}
```

---

## 📦 Recommended Project Structure

```
devsync.ai/
├── packages/
│   ├── cli/              # CLI agent (Phase 1)
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── core-engine/      # Core analyzer (Phase 2+)
│   │   ├── src/
│   │   │   ├── analyzer/
│   │   │   ├── migrator/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ide-extension/    # VS Code extension (Phase 4)
│       ├── src/
│       └── package.json
│
├── apps/
│   ├── web/             # Next.js dashboard (Phase 2+)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── landing/         # Current landing page
│       └── src/
│
├── docs/                 # Documentation
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── QUICK_START.md
│
└── package.json          # Monorepo root (optional)
```

---

## ✅ Checklists

### Phase 1 Checklist (CLI MVP)

- [ ] CLI package structure created
- [ ] `devsync scan` command works
- [ ] Can parse Prisma schema
- [ ] Can connect to PostgreSQL
- [ ] Diff engine compares schemas
- [ ] Pretty console output
- [ ] Published to NPM (optional)

### Phase 2 Checklist (Dashboard)

- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] Next.js app set up
- [ ] Authentication working
- [ ] Projects list page
- [ ] Scan results display
- [ ] CLI sends reports to cloud

### Phase 3 Checklist (Migrations)

- [ ] SQL migration generator
- [ ] Prisma migration generator
- [ ] Safety validator
- [ ] Preview UI in dashboard
- [ ] CLI apply command
- [ ] Dry-run mode

---

## 🐛 Troubleshooting

### CLI Issues

**Problem**: `devsync: command not found`
**Solution**: Run `npm link` or install globally with `npm install -g devsync`

**Problem**: Can't connect to database
**Solution**: Check connection string format: `postgresql://user:pass@host:port/db`

### Supabase Issues

**Problem**: RLS blocking queries
**Solution**: Check RLS policies in Supabase dashboard, ensure user is authenticated

**Problem**: Edge Functions not deploying
**Solution**: Check `supabase/functions/` structure and `supabase deploy` command

---

## 📚 Next Steps

1. **Start with Phase 1**: Build CLI MVP (2 weeks)
2. **Test with real project**: Use your own Prisma + PostgreSQL project
3. **Iterate**: Add features based on what you learn
4. **Move to Phase 2**: When ready for dashboard

See `ROADMAP.md` for detailed phase-by-phase instructions.

---

## 💡 Tips

- **Start small**: Phase 1 proves the concept
- **Use TypeScript**: Catches errors early
- **Test locally first**: Don't deploy until it works locally
- **Iterate fast**: Build, test, learn, repeat

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-XX

