# Devsync AI

**AI-powered CLI & VS Code Extension for Database ↔ Backend Synchronization**

Devsync AI is a developer tool that **automatically understands, validates, and synchronizes database schemas with backend codebases**. It scans projects, detects database connections or schema definitions, reverse‑engineers schemas from live databases or code, and uses AI to **identify conflicts, suggest fixes, and safely apply migrations or code changes**.

This README is written to be given directly to **Cursor** (or another AI coding agent) to build the product **end‑to‑end**, with a strong emphasis on correctness, safety, extensibility, and real‑world robustness.

---

## 1. Problem Devsync Solves

Modern projects often suffer from:

- Schema drift between database and backend models
- Missing or outdated migrations
- Broken or insecure DB connection strings
- Silent runtime errors caused by mismatched fields, types, or relations
- Lack of a single source of truth for schema evolution

**Devsync AI acts as a schema intelligence layer** between your codebase and your database.

---

## 2. Core Capabilities

### 2.1 Intelligent Database Discovery

Devsync can determine the database schema using **multiple strategies**:

#### Option A – Live Database Inspection
- Detect database connection strings
- Connect securely (read‑only by default)
- Extract:
  - Tables
  - Columns
  - Types
  - Indexes
  - Constraints
  - Relationships

#### Option B – Schema File Detection
- Scan project directory for known schema files:
  - `.sql`
  - `.prisma`
  - `schema.rb`
  - `migrations/*`
  - `typeorm` entities
  - `sequelize` models
  - `drizzle` schemas

#### Option C – Codebase Inference
- Recursively read **every file** in the project
- Detect:
  - ORM models
  - Raw SQL queries
  - Query builders
  - Repository layers
  - Data access patterns
- Infer implicit schema definitions from usage

---

## 3. Supported Technologies (Initial Scope)

### Databases
- PostgreSQL
- MySQL / MariaDB
- SQLite
- MongoDB (schema inference)

### ORMs / Tools
- Prisma
- TypeORM
- Sequelize
- Drizzle
- Mongoose
- Knex
- Raw SQL

### Languages
- TypeScript / JavaScript
- Python
- Go
- Java

---

## 4. Architecture Overview

```
┌────────────────────────────┐
│        VS Code UI          │
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│        Devsync CLI         │
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│   Project Scanner Engine   │
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│   Schema Normalization     │
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│        AI Engine           │
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│   Fix / Migration Engine   │
└────────────────────────────┘
```

---

## 5. High-Level Flow (From devsync.pdf)

1. **Devsync Scan**
2. Check for database connection string
3. If found → Inspect live DB
4. Else → Look for schema files (`.sql`, `.prisma`, etc.)
5. Else → Deep codebase scan
6. Normalize schema representations
7. Compare database ↔ backend models
8. Detect conflicts
9. AI suggests fixes or migrations
10. User approves actions

---

## 6. CLI Design

### 6.1 Installation

```bash
npm install -g devsync
```

### 6.2 Commands

```bash
devsync scan
```
- Detect DB, schema files, and backend models

```bash
devsync status
```
- Show schema drift summary

```bash
devsync fix
```
- AI‑generated suggestions (dry‑run)

```bash
devsync apply
```
- Apply approved fixes or migrations

```bash
devsync init
```
- Setup config, API keys, defaults

---

## 7. VS Code Extension

### Features
- Status bar schema health indicator
- Inline diagnostics
- Hover explanations for mismatches
- One‑click AI fixes
- Migration preview UI

### Tech Stack
- VS Code Extension API
- Webview for diff & migration previews
- Communicates with CLI via IPC

---

## 8. Project Scanner Engine

### Responsibilities
- File system traversal
- Ignore rules (`.gitignore`, `.devsyncignore`)
- Language detection
- ORM & SQL pattern matching

### Key Modules
- `ConnectionStringDetector`
- `SchemaFileDetector`
- `ORMModelParser`
- `RawSQLAnalyzer`

---

## 9. Schema Normalization Layer

Convert all inputs into a unified format:

```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "uuid", "nullable": false }
      ],
      "relations": []
    }
  ]
}
```

This allows deterministic comparisons regardless of source.

---

## 10. AI Engine

### Responsibilities
- Understand schema intent
- Detect semantic mismatches
- Propose minimal, safe changes

### Inputs
- Normalized DB schema
- Normalized backend schema
- Project context
- User preferences

### Outputs
- Conflict explanations
- Suggested code diffs
- Suggested SQL migrations

### AI API Usage
- Use user‑provided API keys (already implemented)
- Keys stored securely
- No schema or code sent without explicit consent

---

## 11. Conflict Detection Examples

- Column exists in DB but not in code
- Model field exists but DB column missing
- Type mismatch (`varchar` vs `int`)
- Nullable vs non‑nullable conflict
- Missing foreign keys
- Unsafe defaults

---

## 12. Fix & Migration Engine

### Modes
- **Suggest Only** (default)
- **Apply with Approval**
- **CI Safe Mode** (read‑only)

### Actions
- Generate SQL migrations
- Update ORM models
- Refactor queries
- Add missing indexes

All actions are:
- Version controlled
- Reversible
- Previewed before execution

---

## 13. Security Model

- Read‑only DB access by default
- Explicit opt‑in for writes
- Encrypted credential storage
- No hidden background execution

---

## 14. Error Handling & Edge Cases

- Partial schema detection
- Multiple databases
- Monorepos
- Legacy SQL
- Inconsistent environments

Devsync must **fail safely** and always explain uncertainty.

---

## 15. Configuration

`devsync.config.json`

```json
{
  "database": {
    "mode": "auto",
    "writeAccess": false
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4.1"
  }
}
```

---

## 16. Roadmap

- Multi‑DB projects
- GraphQL schema sync
- Data validation rules
- Production drift detection
- CI/CD integration

---

## 17. Success Criteria

Devsync is successful when:
- Schema mismatches are detected **before runtime**
- Fixes are understandable and safe
- Developers trust it in production workflows

---

## 18. Final Instruction to Cursor

> Build Devsync AI exactly as specified above.
> Prioritize correctness, safety, and explainability.
> Never apply destructive changes without user approval.
> Treat schema understanding as a first‑class problem.

---

**End of README**

