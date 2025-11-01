# 📐 DevSync.AI — System Architecture Diagrams

> Visual representations of system architecture, data flows, and component interactions

---

## 🏗️ High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DevSync Cloud Platform                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │   Frontend       │  │   Authentication │  │   AI Service     │              │
│  │   (Next.js)      │  │   (Supabase)     │  │   (OpenAI API)   │              │
│  │                  │  │                  │  │                  │              │
│  │  - Dashboard     │  │  - JWT Auth      │  │  - GPT-4         │              │
│  │  - Reports       │  │  - OAuth         │  │  - Embeddings    │              │
│  │  - Settings      │  │  - API Keys      │  │  - Fine-tuned    │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│                                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐               │
│  │              Core Engine Services (Edge Functions)            │               │
│  ├──────────────────┬──────────────────┬──────────────────────┤               │
│  │ Schema Analyzer  │  Code Scanner    │  Diff Engine         │               │
│  ├──────────────────┼──────────────────┼──────────────────────┤               │
│  │ Migration Gen     │  AI Reasoner     │  Rule Validator      │               │
│  └──────────────────┴──────────────────┴──────────────────────┘               │
│                                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐               │
│  │                    Integration Hub                            │               │
│  ├──────────┬──────────┬──────────┬──────────┬──────────┬───────┤               │
│  │ GitHub   │ Supabase │ Slack    │ Discord  │ Email    │ Webhooks │           │
│  │ API      │ API      │ Bot      │ Bot      │ (Resend) │         │           │
│  └──────────┴──────────┴──────────┴──────────┴──────────┴────────┘               │
│                                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐               │
│  │                    Data & Storage Layer                        │               │
│  ├──────────────────┬──────────────────┬──────────────────────┤               │
│  │ PostgreSQL       │  Supabase        │  Redis Cache         │               │
│  │ (Supabase)       │  Storage         │  (Upstash)            │               │
│  │                  │                  │                       │               │
│  │ - Projects       │  - Schema        │  - AI Responses       │               │
│  │ - Scan Reports   │    Snapshots     │  - Session Data       │               │
│  │ - Migrations     │  - Logs          │  - Rate Limits       │               │
│  └──────────────────┴──────────────────┴──────────────────────┘               │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    ▲                    ▲
                                    │                    │
                         HTTPS/WSS  │                    │  WebSocket/HTTP
                                    │                    │
         ┌──────────────────────────┴────────┐  ┌────────┴──────────────────────────┐
         │                                   │  │                                   │
    ┌────┴──────────┐                ┌─────┴──┴─────────┐                   ┌─────┴────────┐
    │               │                │                  │                   │            │
┌───┴──────┐  ┌─────┴────────┐  ┌───┴──────┐  ┌───────┴──────┐      ┌───────┴──────┐  ┌──┴──────────┐
│ IDE      │  │ CLI Agent    │  │ GitHub   │  │ CI/CD       │      │ User's       │  │ CI/CD       │
│ Extension│  │ (Local)       │  │ PR Bot   │  │ Webhooks    │      │ Database     │  │ Pipeline    │
│          │  │              │  │          │  │             │      │              │  │             │
│ Cursor/  │  │ - Scans code │  │ - PR     │  │ - Auto-scan │      │ PostgreSQL/ │  │ - GitHub    │
│ VS Code  │  │ - Connects   │  │   comments│  │   on commit│      │ MySQL/      │  │   Actions   │
│          │  │   to DB      │  │ - Branch  │  │ - Block     │      │ Supabase    │  │ - GitLab    │
│ - Inline │  │ - Reports    │  │   protection│  │   merges    │      │             │  │ - Docker    │
│   warnings│  │   to cloud  │  │           │  │             │      │             │  │             │
└──────────┘  └──────────────┘  └──────────┘  └──────────────┘      └──────────────┘  └─────────────┘
```

---

## 🔄 Data Flow: Scan Process

### Flow 1: Manual Scan (MVP)

```
Developer                         CLI Agent                      Cloud API                    Database
   │                                 │                              │                            │
   │  $ devsync scan                 │                              │                            │
   ├────────────────────────────────>│                              │                            │
   │                                 │                              │                            │
   │                                 │  1. Scan codebase            │                            │
   │                                 │     (Prisma schema, etc.)    │                            │
   │                                 ├──────────────────────────────┼──────────────────────────>│
   │                                 │                              │        2. Extract DB schema│
   │                                 │<─────────────────────────────┼───────────────────────────┤
   │                                 │                              │    3. Return schema       │
   │                                 │                              │                            │
   │                                 │  4. Compare code vs DB       │                            │
   │                                 │  5. Generate diff report     │                            │
   │                                 │                              │                            │
   │                                 │  6. POST /api/v1/scans       │                            │
   │                                 ├─────────────────────────────>│                            │
   │                                 │                              │  7. Store in database     │
   │                                 │<─────────────────────────────┤                            │
   │                                 │  8. Return scan ID           │                            │
   │                                 │                              │                            │
   │                                 │  9. Display results          │                            │
   │   [Mismatches displayed]        │                              │                            │
   │<────────────────────────────────┤                              │                            │
   │                                 │                              │                            │
```

### Flow 2: Continuous Monitoring (Beta)

```
Developer                         CLI Agent                      Cloud API                    Database
   │                                 │                              │                            │
   │  $ devsync watch                │                              │                            │
   ├────────────────────────────────>│                              │                            │
   │                                 │                              │                            │
   │                                 │  ┌──────────────────────┐   │                            │
   │                                 │  │ Watch file system    │   │                            │
   │                                 │  │ (schema.prisma)      │   │                            │
   │                                 │  └──────────────────────┘   │                            │
   │                                 │                              │                            │
   │  [File changed detected]       │                              │                            │
   │                                 │                              │                            │
   │                                 │  1. Trigger scan            │                            │
   │                                 ├─────────────────────────────┼──────────────────────────>│
   │                                 │                              │    2. Poll DB schema      │
   │                                 │<─────────────────────────────┼───────────────────────────┤
   │                                 │                              │    3. Return schema       │
   │                                 │                              │                            │
   │                                 │  4. Generate diff            │                            │
   │                                 │  5. POST /api/v1/scans       │                            │
   │                                 ├─────────────────────────────>│                            │
   │                                 │                              │  6. Store + trigger AI    │
   │                                 │                              ├───────────────────────────>│
   │                                 │                              │    7. Generate explanation │
   │                                 │                              │<───────────────────────────┤
   │                                 │<─────────────────────────────┤                            │
   │                                 │  8. Send notification        │                            │
   │                                 │                              │                            │
   │  [Notification received]        │                              │                            │
   │  - IDE shows warning            │                              │                            │
   │  - Slack message sent           │                              │                            │
   │  - Email notification           │                              │                            │
   │<────────────────────────────────┤                              │                            │
```

### Flow 3: IDE Extension Interaction

```
IDE Extension                      CLI Agent (Local API)          Cloud API                    Database
   │                                 │                              │                            │
   │  [User opens schema.prisma]    │                              │                            │
   │                                 │                              │                            │
   │  1. Request scan status        │                              │                            │
   │├───────────────────────────────>│                              │                            │
   │                                 │  2. Check cached scan        │                            │
   │                                 │  3. Or trigger new scan      │                            │
   │                                 │                              │                            │
   │                                 │  4. Return mismatches        │                            │
   │<───────────────────────────────┤                              │                            │
   │                                 │                              │                            │
   │  5. Display inline warnings     │                              │                            │
   │  [Red squiggle on line]        │                              │                            │
   │                                 │                              │                            │
   │  [User clicks "Quick Fix"]     │                              │                            │
   │                                 │                              │                            │
   │  6. Apply migration            │                              │                            │
   │├───────────────────────────────>│                              │                            │
   │                                 │  7. POST /api/v1/migrations  │                            │
   │                                 │├────────────────────────────>│                            │
   │                                 │                              │  8. Generate migration    │
   │                                 │<─────────────────────────────┤                            │
   │                                 │  9. Apply to database        │                            │
   │                                 ├──────────────────────────────┼──────────────────────────>│
   │                                 │                              │                            │
   │  10. Show success notification │                              │                            │
   │<───────────────────────────────┤                              │                            │
```

---

## 🗄️ Database Schema Relationship Diagram

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   users     │         │    teams     │         │ team_members │
│             │         │              │         │              │
│ - id (PK)   │         │ - id (PK)    │◄───────►│ - id (PK)    │
│ - email     │         │ - name       │         │ - team_id    │
│ - name      │         │ - slug       │         │ - user_id    │
└─────────────┘         └──────────────┘         │ - role       │
      │                       │                  └──────────────┘
      │                       │
      │                       │
      │                       │
      ▼                       ▼
┌─────────────────────────────────────────┐
│            projects                     │
│                                          │
│ - id (PK)                                │
│ - user_id (FK) ────────────────────────┼──► users
│ - team_id (FK) ────────────────────────┼──► teams
│ - name                                   │
│ - db_connection_string (encrypted)      │
│ - schema_type                            │
└─────────────────────────────────────────┘
      │
      │
      ├───────────────────────────────────┐
      │                                   │
      ▼                                   ▼
┌──────────────────────────┐    ┌──────────────────────┐
│   schema_snapshots       │    │    scan_reports     │
│                          │    │                     │
│ - id (PK)                │    │ - id (PK)           │
│ - project_id (FK) ───────┼───►│ - project_id (FK)   │
│ - schema (JSONB)         │    │ - status            │
│ - hash                   │    │ - mismatches (JSONB)│
│ - created_at             │    │ - code_schema       │
└──────────────────────────┘    │ - db_schema         │
                                │ - created_at        │
                                └──────────────────────┘
                                      │
                                      │
                                      ▼
                              ┌──────────────────────┐
                              │    migrations       │
                              │                     │
                              │ - id (PK)           │
                              │ - scan_report_id    │
                              │ - filename          │
                              │ - content           │
                              │ - safety_score      │
                              │ - applied           │
                              └──────────────────────┘
```

---

## 🔐 Authentication & Authorization Flow

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  User    │                    │ Frontend │                    │ Supabase │
│          │                    │ (Next.js)│                    │  Auth    │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                                │                               │
     │  1. Login request              │                               │
     ├───────────────────────────────>│                               │
     │                                │  2. POST /auth/v1/token      │
     │                                ├─────────────────────────────>│
     │                                │                               │
     │                                │  3. JWT token returned       │
     │                                │<─────────────────────────────┤
     │  4. Session stored             │                               │
     │<───────────────────────────────┤                               │
     │                                │                               │
     │  5. API request (with JWT)     │                               │
     ├───────────────────────────────>│                               │
     │                                │  6. Verify JWT               │
     │                                ├─────────────────────────────>│
     │                                │                               │
     │                                │  7. Token valid               │
     │                                │<─────────────────────────────┤
     │  8. Request authorized         │                               │
     │<───────────────────────────────┤                               │
     │                                │                               │
     │  9. Access granted (RLS check)  │                               │
     │                                │                               │
```

**Row Level Security (RLS) Example**:
```sql
-- Users can only access projects they own or are members of
CREATE POLICY "project_access"
  ON projects FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
    )
  );
```

---

## 🚀 Deployment Architecture by Phase

### Phase 1: CLI MVP (Local Only)

```
┌──────────────────────┐
│   Developer Machine  │
│                      │
│  ┌────────────────┐  │
│  │  devsync CLI   │  │
│  │  (NPM package) │  │
│  └────────────────┘  │
│         │             │
│         ▼             │
│  ┌────────────────┐  │
│  │ User's Database│  │
│  │ (PostgreSQL)   │  │
│  └────────────────┘  │
└──────────────────────┘

No cloud infrastructure needed
```

### Phase 2-3: Dashboard + Migrations

```
┌──────────────────┐        ┌──────────────┐        ┌──────────────┐
│     Vercel       │        │  Supabase    │        │   Domain     │
│                  │        │              │        │              │
│  ┌────────────┐  │        │  ┌────────┐  │        │ devsync.ai   │
│  │  Next.js   │  │◄──────►│  │  PG    │  │        │              │
│  │  App       │  │ HTTPS  │  │  Auth  │  │        │   DNS: A     │
│  └────────────┘  │        │  │ Storage│  │        │   record     │
└──────────────────┘        └──────────────┘        └──────────────┘
         ▲
         │ HTTPS
         │
┌────────┴────────┐
│  User Browser   │
└─────────────────┘

Cost: $0-15/month
```

### Phase 6+: AI + Notifications

```
┌──────────────────┐        ┌──────────────┐        ┌──────────────┐
│     Vercel       │        │  Supabase    │        │   OpenAI     │
│  ┌────────────┐  │        │  ┌────────┐  │        │              │
│  │  Next.js   │  │◄──────►│  │  PG    │  │◄──────►│  GPT-4 API   │
│  │  App       │  │        │  │  Auth  │  │        │              │
│  └────────────┘  │        │  │ Storage│  │        └──────────────┘
└──────────────────┘        │  │ Functions│ │
         ▲                  └──────────────┘
         │ HTTPS                   │
         │                         │
┌────────┴────────┐       ┌────────┴────────┐
│  User Browser   │       │  Resend/Slack  │
└─────────────────┘       └─────────────────┘

Cost: $100-275/month
```

### Phase 8: Enterprise Scale

```
┌──────────────────┐        ┌──────────────┐        ┌──────────────┐
│  Vercel (Pro)    │        │ Supabase     │        │   OpenAI     │
│  + CDN           │        │  Team        │        │  (Scale up)  │
│                  │        │              │        │              │
│  ┌────────────┐  │        │  ┌────────┐  │        │  + Cache     │
│  │  Next.js   │  │◄──────►│  │  PG    │  │◄──────►│              │
│  │  (Multi)    │  │        │  │  + RLS │  │        └──────────────┘
│  └────────────┘  │        │  │  Replica│  │
└──────────────────┘        │  │  Storage│  │
         ▲                  │  │ Functions│ │
         │                  └──────────────┘
         │                         │
┌────────┴────────┐       ┌────────┴────────┐
│  Users          │       │  Sentry/        │
│  (1000+)        │       │  PostHog        │
└─────────────────┘       └─────────────────┘

Cost: $1,100-1,800/month
```

---

## 🔄 Component Interaction Sequence

### Sequence: Full Scan + AI Explanation

```
User         CLI        Frontend      Cloud API      OpenAI      Database
 │            │            │              │            │            │
 │─scan──────>│            │              │            │            │
 │            │─scan───────┼──────────────┼───────────>│            │
 │            │            │              │            │            │
 │            │            │              │───────────>│            │
 │            │            │              │            │            │
 │            │            │              │<───────────┤            │
 │            │            │              │   explanation           │
 │            │            │<─────────────┤            │            │
 │            │<───────────┤              │            │            │
 │<─results───┤            │              │            │            │
 │            │            │              │            │            │
```

### Sequence: IDE Quick Fix

```
User         IDE        CLI (Local)    Cloud API      Database
 │            │            │              │            │
 │─open──────>│            │              │            │
 │            │─status────>│              │            │
 │            │<─status────┤              │            │
 │            │            │              │            │
 │─quick fix─>│            │              │            │
 │            │─apply──────>│              │            │
 │            │            │─migration────>│            │
 │            │            │              │───────────>│
 │            │            │              │<───────────┤
 │            │            │<─success──────┤            │
 │<─success───┤            │              │            │
 │            │            │              │            │
```

---

## 📊 Scaling Dimensions

### Horizontal Scaling (Add More Instances)

```
Phase 2-6:                    Phase 8:
┌─────────┐                  ┌─────────┐  ┌─────────┐
│ Instance│                  │Instance1│  │Instance2│
│    1    │                  └─────────┘  └─────────┘
└─────────┘                         │           │
                                    └─────┬─────┘
                                          │
                                    ┌─────▼─────┐
                                    │   Load    │
                                    │  Balancer │
                                    └───────────┘
```

### Vertical Scaling (Bigger Instances)

```
Database Size Growth:
Phase 2:  100 MB  →  Phase 6:  2 GB  →  Phase 8:  10 GB+
          │                          │              │
          └────────── Supabase ──────┴──────────────┘
          Free tier        Pro tier      Team tier
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────┐
│              Security Perimeter                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Layer 1: Network Security                    │ │
│  │  - HTTPS/TLS encryption                       │ │
│  │  - DDoS protection (Vercel)                   │ │
│  │  - Firewall rules                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Layer 2: Authentication                      │ │
│  │  - JWT tokens (Supabase Auth)                │ │
│  │  - API keys (encrypted storage)               │ │
│  │  - OAuth (GitHub, Google)                     │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Layer 3: Authorization                      │ │
│  │  - Row Level Security (RLS)                    │ │
│  │  - Role-based access control                  │ │
│  │  - Team permissions                           │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Layer 4: Data Protection                     │ │
│  │  - Encryption at rest (database)              │ │
│  │  - Encryption in transit (HTTPS)              │ │
│  │  - Encrypted connection strings               │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-XX

