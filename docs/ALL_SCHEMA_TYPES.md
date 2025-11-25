# All Supported Schema Types ✅

## Complete List

DevSync now supports **9 schema types** across JavaScript, TypeScript, and Python!

### JavaScript/TypeScript ORMs

1. ✅ **Prisma** - `prisma/schema.prisma`
2. ✅ **Supabase** - `supabase/migrations/*.sql` (Most important!)
3. ✅ **TypeORM** - `*.entity.ts` files
4. ✅ **Kysely** - `schema.ts` or SQL template literals
5. ✅ **Sequelize** - `*.model.js/ts` files
6. ✅ **Drizzle ORM** - `schema.ts` files

### Python ORMs

7. ✅ **Django** - `models.py` files
8. ✅ **SQLAlchemy** - `*.py` files with SQLAlchemy models

### Raw SQL

9. ✅ **Raw SQL** - `*.sql` migration files

---

## Detection Priority

DevSync tries each type in order:

1. **Prisma** (highest priority - most common)
2. **Supabase** (second priority - most important!)
3. **TypeORM** (third priority)
4. **Kysely** (fourth priority)
5. **Sequelize** (fifth priority)
6. **Drizzle** (sixth priority)
7. **Django** (seventh priority)
8. **SQLAlchemy** (eighth priority)
9. **Raw SQL** (fallback - lowest priority)

---

## Detailed Support

### ✅ Supabase (Most Important!)

**Location**: `supabase/migrations/*.sql`  
**Status**: Fully supported with priority detection

**Example**:
```sql
-- supabase/migrations/20240101000000_initial.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features**:
- ✅ Scans all SQL files in `supabase/migrations/`
- ✅ Extracts `CREATE TABLE` statements
- ✅ Merges tables from multiple migrations
- ✅ High priority detection (checked immediately after Prisma)

### ✅ Kysely

**Location**: `src/db/schema.ts`, `schema.ts`, or files with Kysely table definitions  
**Status**: Fully supported

**Example 1 - SQL Template Literals**:
```typescript
import { sql } from 'kysely';

export const users = sql`
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT
  )
`;
```

**Example 2 - Object-based Syntax**:
```typescript
import { table } from 'kysely';

export const users = table('users', {
  id: uuid('id').primaryKey().defaultTo(genRandomUuid()),
  email: text('email').notNull().unique(),
  name: text('name'),
});
```

**Features**:
- ✅ Detects both SQL template literals and object-based syntax
- ✅ Searches common paths: `src/db/schema.ts`, `src/database/schema.ts`, etc.
- ✅ Recursively searches for files with Kysely patterns

### ✅ Django Models

**Location**: `models.py`, `app/models.py`, `apps/**/models.py`  
**Status**: Fully supported

**Example**:
```python
from django.db import models

class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'users'
```

**Features**:
- ✅ Detects Django model classes (`class ModelName(models.Model)`)
- ✅ Parses field types (CharField, IntegerField, etc.)
- ✅ Extracts table name from Meta class or converts class name
- ✅ Recursively searches for `models.py` files

### ✅ SQLAlchemy Models

**Location**: `models.py`, `*.py` files with SQLAlchemy imports  
**Status**: Fully supported

**Example**:
```python
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(String, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

**Features**:
- ✅ Detects SQLAlchemy model classes (`class ModelName(Base)`)
- ✅ Parses Column definitions
- ✅ Extracts table name from `__tablename__` or converts class name
- ✅ Recursively searches for Python files with SQLAlchemy imports

---

## Usage

Just use DevSync as before - it automatically detects your schema type:

```bash
# Works with ANY supported schema type!
devsync scan --path ./my-project

# With database connection
devsync scan --path ./my-project --db postgresql://...
```

---

## File Patterns Detected

### Supabase
- `supabase/migrations/*.sql`
- All SQL files in Supabase migrations directory

### Kysely
- `src/db/schema.ts`
- `src/database/schema.ts`
- `src/db/tables.ts`
- `src/schema.ts`
- `schema.ts`
- Files with `sql` template literals or `table()` calls

### Django
- `models.py`
- `app/models.py`
- `apps/**/models.py` (recursive)
- `src/**/models.py` (recursive)

### SQLAlchemy
- `models.py`
- `app/models.py`
- `src/models.py`
- `src/**/*.py` (recursive, files with SQLAlchemy imports)

---

## Type Mapping

All schema types are normalized to PostgreSQL types:

| Source Type | PostgreSQL Type |
|------------|----------------|
| `String` / `varchar` / `TEXT` | `text` |
| `Int` / `integer` / `INTEGER` | `integer` |
| `BigInt` / `bigint` / `BIGINT` | `bigint` |
| `Boolean` / `boolean` / `BOOLEAN` | `boolean` |
| `Date` / `DateTime` / `DATE` | `timestamp` |
| `Json` / `json` / `JSON` | `jsonb` |
| `UUID` / `uuid` | `uuid` |

---

## Status

✅ **All 9 schema types implemented and working!** 🎉

DevSync is now truly universal - works with virtually any ORM or schema definition!

