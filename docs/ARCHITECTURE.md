# 🏗️ DevSync.AI — Technical Architecture Specification

> **Mission**: Continuously synchronize, analyze, and self-heal inconsistencies between an app's codebase, database, and cloud configuration.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Technology Stack](#technology-stack)
5. [Module Specifications](#module-specifications)
6. [API Contracts](#api-contracts)
7. [Database Schema](#database-schema)
8. [Security & Authentication](#security--authentication)
9. [Deployment Architecture](#deployment-architecture)

---

## 🎯 System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DevSync Cloud Platform                   │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)    │  Auth (Supabase)  │  AI Service (GPT-5) │
├─────────────────────────────────────────────────────────────────┤
│  Core Engine Services                                            │
│  ├─ Schema Analyzer    │  Code Scanner     │  Diff Engine        │
│  ├─ Migration Generator│  AI Reasoner      │  Rule Validator     │
├─────────────────────────────────────────────────────────────────┤
│  Integration Hub                                                │
│  ├─ GitHub API        │  Supabase API     │  Slack/Discord       │
│  ├─ IDE Extension API │  CI/CD Webhooks   │  Storage API         │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                      │
│  ├─ PostgreSQL (Supabase) │  File Storage │  Redis Cache        │
└─────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │                                    │
    ┌────┴──────────┐                  ┌─────┴───────────┐
    │              │                  │              │
┌───┴──────┐  ┌───┴──────────┐   ┌───┴───────┐ ┌───┴────────┐
│ IDE Plugin│  │  CLI Agent   │   │ GitHub     │ │ CI/CD      │
│(Cursor/VSC)│  │ (Local/CI)   │   │ Integration│ │ Webhooks   │
└──────────┘  └──────────────┘   └────────────┘ └────────────┘
```

### Key Design Principles

1. **Modular & Extensible**: Each component is independently deployable
2. **Offline-First**: CLI agent works without cloud connectivity
3. **Real-Time Sync**: WebSocket connections for live updates
4. **Security by Default**: All access requires authentication
5. **Scalable by Design**: Stateless services, horizontal scaling

---

## 🔧 Core Components

### 1. Client Application (Frontend)

**Purpose**: Web dashboard for project management, reports, and configuration

**Tech Stack**:
- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18, Tailwind CSS, shadcn/ui
- **State**: TanStack Query (React Query), Zustand
- **Auth**: Supabase Auth (client-side)
- **Real-time**: Supabase Realtime subscriptions

**Key Features**:
- Project dashboard with schema diff visualization
- Migration suggestion review & approval
- Team collaboration & notifications
- Settings & configuration management
- Historical drift reports & analytics

**Scale**: Small–Medium (handles 100–1000 concurrent users)

---

### 2. Core Engine (Analyzer Service)

**Purpose**: Core logic for scanning, analyzing, and generating fixes

**Tech Stack**:
- **Runtime**: Node.js 20+ (TypeScript) or Deno
- **Parsing**: Babel parser, TypeScript compiler API
- **SQL Analysis**: `pg` library, custom SQL parser
- **Diff Engine**: Custom implementation + `diff` libraries
- **Deployment**: Cloud Functions (Supabase Edge Functions / Fly.io)

**Capabilities**:
- **Code Scanner**: Extracts Prisma schemas, TypeORM entities, SQL models
- **Schema Extractor**: Connects to DB and extracts current schema
- **Diff Engine**: Compares code schema vs DB schema
- **Migration Generator**: Creates SQL/Prisma migration scripts
- **RLS Auditor**: Analyzes Supabase Row Level Security policies
- **API Consistency Checker**: Validates endpoint ↔ schema alignment

**Scale**: Medium–High (CPU-intensive, scales horizontally)

**Input**:
```typescript
{
  projectId: string;
  codebasePath: string;
  dbConnectionString: string;
  schemaType: 'prisma' | 'typeorm' | 'raw-sql';
}
```

**Output**:
```typescript
{
  mismatches: Array<{
    type: 'missing_field' | 'type_mismatch' | 'extra_field' | 'constraint_mismatch';
    model: string;
    field?: string;
    codeValue: any;
    dbValue: any;
    severity: 'error' | 'warning' | 'info';
    suggestedFix: string;
  }>;
  migrations: Array<{
    filename: string;
    sql: string;
    prisma?: string;
    safetyScore: number; // 0-1, confidence in auto-apply
  }>;
}
```

---

### 3. Agent Service (CLI / Local Daemon)

**Purpose**: Background process running locally or in CI that scans and reports

**Tech Stack**:
- **Language**: Node.js (TypeScript) — future: Rust for performance
- **CLI Framework**: Commander.js or Clack
- **File Watching**: Chokidar
- **Package**: NPM/PNPM installable CLI tool

**Features**:
- File system scanning (watches for schema/model changes)
- Database connection & schema extraction
- Sends reports to cloud API (or works offline)
- IDE integration hooks (via extension)

**Commands**:
```bash
devsync init              # Initialize project
devsync scan              # One-time scan
devsync watch             # Continuous monitoring
devsync fix --apply       # Auto-apply safe fixes
devsync diff              # Show differences
devsync status            # Current sync status
```

**Scale**: High (runs on millions of dev machines, but local)

---

### 4. AI Reasoner Layer

**Purpose**: Natural language explanations, migration suggestions, compliance checks

**Tech Stack**:
- **Primary**: OpenAI GPT-4/GPT-5 API
- **Fallback**: Local LLMs (Llama 3, Mistral) via Ollama
- **Embeddings**: OpenAI embeddings for semantic search
- **Fine-tuning**: Custom fine-tuned model for schema reasoning (future)

**Use Cases**:
1. **Migration Explanation**: "This migration adds a `deletedAt` field to support soft deletes..."
2. **Risk Assessment**: "Changing this column type may cause data loss for 150 existing records..."
3. **Compliance Audit**: "Your RLS policy allows public read access — consider restricting..."
4. **Natural Language Queries**: "Show me all tables that reference the `users` table"

**Cost Considerations**:
- Cache common queries
- Batch requests
- Use cheaper models for simple tasks
- Fine-tuned model reduces API calls

**Scale**: Medium (API rate limits, caching reduces load)

---

### 5. Database & Storage (Supabase)

**Purpose**: Persistent storage for projects, logs, schema snapshots

**Tech Stack**:
- **Primary DB**: PostgreSQL (Supabase)
- **File Storage**: Supabase Storage (S3-compatible)
- **Cache**: Redis (Supabase Edge Functions or external)

**Key Tables** (see [Database Schema](#database-schema)):
- `projects` — Project configurations
- `schema_snapshots` — Historical schema states
- `scan_reports` — Scan results and diffs
- `migrations` — Generated migration scripts
- `teams` — Team/organization management
- `api_keys` — Authentication tokens

**Scale**: Medium–High (Postgres scales to 100k+ projects)

---

### 6. Integrations Hub

**Purpose**: Connect with external services (GitHub, IDE, Slack, etc.)

**Tech Stack**:
- **REST APIs**: Node.js microservices
- **Webhooks**: Incoming webhook handlers
- **WebSockets**: Supabase Realtime for live updates
- **OAuth**: GitHub, GitLab OAuth integrations

**Integrations**:
1. **GitHub/GitLab**:
   - PR comments on schema changes
   - Commit hooks for auto-scan
   - Branch protection rules
   
2. **IDE Extensions** (Cursor / VS Code):
   - Inline warnings for mismatches
   - Quick-fix code actions
   - Status bar indicators

3. **Slack/Discord**:
   - Notifications on drift detection
   - Daily/weekly summaries

4. **Supabase API**:
   - Direct schema sync
   - RLS policy auditing

**Scale**: Medium–High (many concurrent connections)

---

### 7. Plugin SDKs

**Purpose**: IDE extensions for real-time feedback

**Tech Stack**:
- **VS Code**: TypeScript extension API
- **Cursor**: Compatible with VS Code API
- **JetBrains**: Kotlin/Java plugin SDK

**Features**:
- Inline diagnostics (similar to ESLint)
- Code actions for auto-fix
- Status bar with sync status
- Command palette integration

**Scale**: Medium (runs client-side, no server load)

---

## 🔄 Data Flow Architecture

### Scan Flow (MVP)

```
1. Developer runs: `devsync scan`
   ↓
2. CLI Agent:
   ├─ Scans local codebase (Prisma schema, models, etc.)
   ├─ Connects to database (reads schema)
   └─ Computes diff locally
   ↓
3. CLI sends report to Cloud API (optional)
   POST /api/v1/scans
   {
     projectId: "proj_123",
     timestamp: "2024-01-01T12:00:00Z",
     mismatches: [...],
     metadata: { codeVersion: "abc", dbVersion: "xyz" }
   }
   ↓
4. Core Engine processes report:
   ├─ Stores in database
   ├─ Generates migration suggestions (if enabled)
   └─ Sends notification (Slack, email, etc.)
   ↓
5. Frontend dashboard updates in real-time
   (via Supabase Realtime subscription)
```

### Continuous Monitoring Flow (Beta)

```
1. Developer runs: `devsync watch`
   ↓
2. CLI Agent:
   ├─ Watches file system (schema files, migrations)
   ├─ Polls database schema every N minutes
   └─ On change detected → triggers scan
   ↓
3. Cloud receives scan result
   ↓
4. AI Reasoner evaluates severity & generates explanation
   ↓
5. Notifications sent:
   ├─ IDE extension shows inline warning
   ├─ Slack message to team channel
   └─ Dashboard shows alert
   ↓
6. Developer reviews suggestion in dashboard
   ↓
7. Developer approves migration → CLI applies it
```

### IDE Extension Flow

```
1. Developer opens code file (e.g., `schema.prisma`)
   ↓
2. IDE Extension:
   ├─ Registers file watcher
   ├─ Calls local CLI agent API (HTTP on localhost)
   └─ Receives current sync status
   ↓
3. Extension displays:
   ├─ Red squiggle on mismatched fields
   ├─ Hover tooltip with diff details
   └─ Code action: "Apply migration"
   ↓
4. User clicks "Apply migration"
   ↓
5. Extension calls CLI: `devsync fix --field users.email`
   ↓
6. CLI applies fix → Updates status
```

---

## 🛠️ Technology Stack

### Frontend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14+ | SSR, routing, API routes |
| UI Library | React 18 | Component library |
| Styling | Tailwind CSS | Utility-first CSS |
| Components | shadcn/ui | Accessible component primitives |
| State Management | TanStack Query + Zustand | Server state + client state |
| Forms | React Hook Form + Zod | Form validation |
| Real-time | Supabase Realtime | Live updates |
| Auth | Supabase Auth | User authentication |

### Backend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20+ | JavaScript runtime |
| Language | TypeScript | Type safety |
| Database | PostgreSQL (Supabase) | Primary data store |
| ORM/Query | Supabase Client | Database queries |
| File Storage | Supabase Storage | Schema snapshots, logs |
| Functions | Supabase Edge Functions | Serverless functions |
| Queue | Supabase + Redis (optional) | Job queue |
| AI Service | OpenAI API | LLM integration |
| Cache | Redis | Response caching |

### CLI/Agent Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | CLI execution |
| CLI Framework | Commander.js / Clack | Command parsing |
| File Watching | Chokidar | Watch for changes |
| Database Client | `pg` (PostgreSQL) | DB connection |
| Code Parsing | Babel, TypeScript API | Parse code files |
| HTTP Client | `fetch` / `axios` | API communication |

### Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Hosting | Vercel / Fly.io | Frontend + API |
| Database | Supabase | PostgreSQL + Auth |
| Storage | Supabase Storage | File storage |
| CDN | Vercel Edge Network | Static assets |
| Monitoring | Sentry | Error tracking |
| Analytics | PostHog / Mixpanel | User analytics |

---

## 📦 Module Specifications

### Module: Schema Analyzer

**Location**: `packages/core-engine/src/analyzer/`

**Responsibilities**:
- Extract schema from code (Prisma, TypeORM, raw SQL)
- Extract schema from database (PostgreSQL, MySQL, etc.)
- Compare schemas and generate diff
- Classify mismatch types (missing field, type mismatch, etc.)

**Exports**:
```typescript
export interface SchemaAnalyzer {
  extractFromCode(codebasePath: string, schemaType: string): Promise<CodeSchema>;
  extractFromDatabase(connectionString: string): Promise<DbSchema>;
  compare(codeSchema: CodeSchema, dbSchema: DbSchema): SchemaDiff;
}

export interface SchemaDiff {
  mismatches: Mismatch[];
  warnings: Warning[];
  metadata: {
    codeVersion: string;
    dbVersion: string;
    timestamp: Date;
  };
}
```

---

### Module: Migration Generator

**Location**: `packages/core-engine/src/migrator/`

**Responsibilities**:
- Generate SQL migration scripts
- Generate Prisma migration files
- Validate migration safety (data loss risk)
- Estimate migration execution time

**Exports**:
```typescript
export interface MigrationGenerator {
  generateMigration(diff: SchemaDiff, format: 'sql' | 'prisma'): Migration[];
  validateSafety(migration: Migration): SafetyReport;
  estimateTime(migration: Migration): number; // seconds
}

export interface Migration {
  filename: string;
  content: string;
  changes: Change[];
  rollback?: string; // Rollback script
  safetyScore: number; // 0-1
}
```

---

### Module: AI Reasoner

**Location**: `packages/ai-reasoner/`

**Responsibilities**:
- Explain migration changes in natural language
- Assess risk and impact
- Suggest optimization strategies
- Answer natural language queries

**Exports**:
```typescript
export interface AIReasoner {
  explainMigration(migration: Migration): Promise<string>;
  assessRisk(migration: Migration): Promise<RiskReport>;
  query(question: string, context: SchemaContext): Promise<string>;
}

export interface RiskReport {
  severity: 'low' | 'medium' | 'high' | 'critical';
  dataLossRisk: boolean;
  downtime: number; // estimated seconds
  affectedRecords: number;
  recommendations: string[];
}
```

---

### Module: CLI Agent

**Location**: `packages/cli/`

**Structure**:
```
cli/
├── src/
│   ├── commands/
│   │   ├── init.ts
│   │   ├── scan.ts
│   │   ├── watch.ts
│   │   ├── fix.ts
│   │   └── diff.ts
│   ├── services/
│   │   ├── scanner.ts
│   │   ├── watcher.ts
│   │   └── api-client.ts
│   └── index.ts
├── bin/
│   └── devsync.js
└── package.json
```

**Commands**:
- `init` — Initialize DevSync in project
- `scan` — Run one-time scan
- `watch` — Continuous monitoring
- `fix` — Apply suggested fixes
- `diff` — Show current differences
- `status` — Show sync status

---

## 🔌 API Contracts

### REST API (Supabase Edge Functions)

**Base URL**: `https://api.devsync.ai/v1`

#### Authentication
All requests require Bearer token:
```
Authorization: Bearer <supabase-jwt-token>
```

#### Endpoints

**POST `/scans`**
Create a new scan report
```typescript
Request:
{
  projectId: string;
  codeSchema: CodeSchema;
  dbSchema: DbSchema;
  metadata?: Record<string, any>;
}

Response:
{
  scanId: string;
  mismatches: Mismatch[];
  migrations?: Migration[];
  createdAt: string;
}
```

**GET `/scans/:scanId`**
Retrieve scan report
```typescript
Response:
{
  scanId: string;
  projectId: string;
  status: 'pending' | 'completed' | 'failed';
  mismatches: Mismatch[];
  migrations: Migration[];
  createdAt: string;
  completedAt?: string;
}
```

**POST `/migrations/:migrationId/apply`**
Apply a migration (generates SQL/Prisma file)
```typescript
Request:
{
  dryRun?: boolean;
  format: 'sql' | 'prisma';
}

Response:
{
  migrationId: string;
  filename: string;
  content: string;
  appliedAt: string;
}
```

**GET `/projects/:projectId/snapshots`**
Get schema snapshot history
```typescript
Response:
{
  snapshots: Array<{
    snapshotId: string;
    timestamp: string;
    schema: DbSchema;
    diffFromPrevious?: SchemaDiff;
  }>;
}
```

**WebSocket** (Supabase Realtime)
Subscribe to project updates:
```typescript
supabase
  .channel(`project:${projectId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'scan_reports',
    filter: `project_id=eq.${projectId}`
  }, (payload) => {
    // New scan report received
  })
  .subscribe();
```

---

## 🗄️ Database Schema

### Core Tables

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  db_connection_string TEXT ENCRYPTED,
  schema_type TEXT DEFAULT 'prisma', -- 'prisma' | 'typeorm' | 'raw-sql'
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema Snapshots
CREATE TABLE schema_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  schema JSONB NOT NULL, -- Full schema state
  hash TEXT NOT NULL, -- SHA-256 hash of schema
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scan Reports
CREATE TABLE scan_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  mismatches JSONB NOT NULL,
  code_schema JSONB,
  db_schema JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Migrations
CREATE TABLE migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_report_id UUID REFERENCES scan_reports(id),
  filename TEXT NOT NULL,
  content TEXT NOT NULL, -- SQL or Prisma migration
  format TEXT DEFAULT 'sql', -- 'sql' | 'prisma'
  safety_score NUMERIC(3,2), -- 0.00 to 1.00
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_snapshots_project_id ON schema_snapshots(project_id);
CREATE INDEX idx_scan_reports_project_id ON scan_reports(project_id);
CREATE INDEX idx_migrations_scan_report_id ON migrations(scan_report_id);
```

---

## 🔒 Security & Authentication

### Authentication Flow

1. **User Registration/Login**: Supabase Auth (email/password, OAuth)
2. **JWT Tokens**: Supabase issues JWT tokens for API access
3. **API Keys**: For CLI/CI usage (stored securely, rotated regularly)
4. **Row Level Security (RLS)**: Supabase RLS policies on all tables

### RLS Policies Example

```sql
-- Projects: Users can only see projects they own or are members of
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- Scan Reports: Users can only see reports for their projects
CREATE POLICY "Users can view project scan reports"
  ON scan_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = scan_reports.project_id
      AND (p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
      ))
    )
  );
```

### API Key Authentication (CLI)

```typescript
// CLI stores API key in ~/.devsync/config.json
{
  "apiKey": "devsync_xxx...",
  "userId": "user_xxx..."
}

// API validates key:
// 1. Check key exists in api_keys table
// 2. Verify key hasn't expired
// 3. Check rate limits
```

---

## 🚀 Deployment Architecture

### MVP Deployment (Phase 1)

```
┌─────────────┐
│   Vercel    │  →  Frontend (Next.js)
└─────────────┘

┌─────────────┐
│  Supabase   │  →  Database + Auth + Storage
└─────────────┘

┌─────────────┐
│  Local CLI  │  →  NPM package (runs on dev machine)
└─────────────┘
```

**Cost**: ~$0–20/month

---

### Beta Deployment (Phase 2–3)

```
┌─────────────┐
│   Vercel    │  →  Frontend
└─────────────┘

┌─────────────┐
│  Supabase   │  →  Database + Auth + Storage + Edge Functions
└─────────────┘

┌─────────────┐
│  Fly.io     │  →  Core Engine (worker processes)
└─────────────┘

┌─────────────┐
│  OpenAI API │  →  AI Reasoning
└─────────────┘
```

**Cost**: ~$50–200/month

---

### Production Deployment (Phase 4+)

```
┌─────────────┐
│   Vercel    │  →  Frontend + CDN
└─────────────┘

┌─────────────┐
│  Supabase   │  →  Database (scaled) + Auth + Storage
└─────────────┘

┌─────────────┐
│  Fly.io     │  →  Core Engine (multiple workers)
│  + Queue    │  →  Job queue (Redis-backed)
└─────────────┘

┌─────────────┐
│  OpenAI API │  →  AI Reasoning + Embeddings
│  + Cache    │  →  Redis for caching responses
└─────────────┘

┌─────────────┐
│  Monitoring │  →  Sentry, PostHog, Logs
└─────────────┘
```

**Cost**: ~$500–2000/month (depending on scale)

---

## 📊 Scalability Considerations

### Database Scaling
- Use read replicas for analytics queries
- Partition `scan_reports` table by `created_at` (monthly partitions)
- Archive old snapshots to cold storage

### API Scaling
- Stateless services → horizontal scaling
- Rate limiting per API key
- Caching frequent queries (Redis)

### AI Service Scaling
- Batch requests when possible
- Cache common explanations
- Fine-tuned model reduces API calls (Phase 6)

---

## 🔄 Next Steps

1. **Review this architecture** with team
2. **Prioritize MVP features** (see ROADMAP.md)
3. **Set up development environment** (Supabase project, local setup)
4. **Build Phase 1: Core CLI MVP** (2 weeks)

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-XX  
**Maintainer**: DevSync.AI Team

