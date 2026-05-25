# API Reference

Complete API reference for Dev-Sync.dev Dashboard API endpoints.

## Base URL

```
http://localhost:3000/api  # Development
https://your-domain.com/api # Production
```

## Authentication

All API endpoints require authentication. Two methods are supported:

### 1. Session Authentication (Web)

Uses Supabase session cookies automatically handled by the browser.

### 2. API Key Authentication (CLI)

Pass JWT token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### Projects

#### GET /api/projects

Get all projects for the authenticated user. Supports session cookies (dashboard) and Bearer tokens (CLI).

**Authentication**: Required

**Query Parameters**:
- `search` (optional) – filter by project name
- `limit` (optional) – number of projects to return (default 50)

**Response**:
```json
{
  "projects": [
    {
      "id": "project-id",
      "name": "My Project",
      "slug": "my-project",
      "schemaType": "prisma",
      "codebaseType": "cli",
      "createdAt": "2024-11-01T10:00:00Z",
      "metadata": {
        "lastScanAt": "2024-11-02T12:00:00Z",
        "lastScanStatus": "completed",
        "mismatchCount": 3
      }
    }
  ]
}
```

#### POST /api/projects

Create a new project. If `slug` is omitted it is generated from the name. `codebase` is optional and defaults to a CLI-managed configuration.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "My Project",
  "slug": "my-project",              // optional
  "schemaType": "prisma",
  "dbConnectionString": "postgresql://user:pass@host/db",
  "codebase": {
    "type": "git",
    "url": "https://github.com/org/repo.git"
  },
  "teamId": null
}
```

**Response**:
```json
{
  "success": true,
  "project": {
    "id": "project-id",
    "name": "My Project",
    "slug": "my-project",
    "schema_type": "prisma",
    "db_connection_string": "postgresql://user:pass@host/db",
    "config": {
      "codebase": {
        "type": "git",
        "status": "pending"
      }
    }
  }
}
```

#### GET /api/projects/{id}

Fetch full project details (including DB connection string) plus latest scan metadata.

**Authentication**: Required

**Response**:
```json
{
  "project": {
    "id": "project-id",
    "name": "My Project",
    "schemaType": "supabase",
    "dbConnectionString": "postgresql://...",
    "config": {
      "codebase": {
        "type": "cli",
        "status": "manual"
      }
    },
    "metadata": {
      "lastScanAt": null,
      "mismatchCount": 0
    }
  }
}
```

#### PATCH /api/projects/{id}

Update project metadata. Only send the fields that should be changed. Sending an empty string for `dbConnectionString` clears the stored value.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Renamed Project",
  "schemaType": "kysely",
  "dbConnectionString": "",
  "codebase": {
    "type": "git",
    "url": "https://github.com/org/new-repo.git"
  }
}
```

**Response**:
```json
{
  "project": {
    "id": "project-id",
    "name": "Renamed Project",
    "schemaType": "kysely",
    "dbConnectionString": null,
    "config": {
      "codebase": {
        "type": "git",
        "url": "https://github.com/org/new-repo.git",
        "status": "pending"
      }
    }
  }
}
```

#### DELETE /api/projects/{id}

Delete a project you own (or have team access to).

**Authentication**: Required

**Response**:
```json
{ "success": true }
```

---

### Scan Reports

#### POST /api/scans

Create a new scan report.

**Authentication**: Required (Session or API Key)

**Request Body**:
```json
{
  "projectId": "project-id",
  "codeSchema": {
    "type": "prisma",
    "models": [...]
  },
  "dbSchema": {
    "type": "postgresql",
    "models": [...]
  },
  "mismatches": [
    {
      "type": "missing_field",
      "model": "User",
      "field": "age",
      "severity": "error",
      "suggestedFix": "ALTER TABLE \"User\" ADD COLUMN \"age\" INTEGER;"
    }
  ]
}
```

**Response**:
```json
{
  "scanId": "scan-report-id",
  "status": "completed",
  "mismatches": [...],
  "created_at": "2024-11-01T10:00:00Z"
}
```

#### GET /api/scans

Get scan reports for a project.

**Authentication**: Required

**Query Parameters**:
- `projectId` (required): Project ID to get scans for

**Response**:
```json
{
  "scans": [
    {
      "id": "scan-id",
      "project_id": "project-id",
      "status": "completed",
      "mismatches": [...],
      "created_at": "2024-11-01T10:00:00Z"
    }
  ]
}
```

---

### Migrations

#### POST /api/migrations

Generate a migration from a scan report.

**Authentication**: Required

**Request Body**:
```json
{
  "scanReportId": "scan-report-id",
  "format": "sql" // or "prisma"
}
```

**Response**:
```json
{
  "migrationId": "migration-id",
  "filename": "20241101_add_columns.sql",
  "sql": "BEGIN; ALTER TABLE ... COMMIT;",
  "format": "sql",
  "createdAt": "2024-11-01T10:00:00Z"
}
```

#### GET /api/migrations

Get migrations for a project or scan report.

**Authentication**: Required

**Query Parameters**:
- `projectId` (optional): Get migrations for all scans in project
- `scanReportId` (optional): Get migrations for specific scan

**Response**:
```json
{
  "migrations": [
    {
      "id": "migration-id",
      "scan_report_id": "scan-report-id",
      "filename": "20241101_add_columns.sql",
      "content": "BEGIN; ... COMMIT;",
      "format": "sql",
      "applied": false,
      "execution_status": "pending",
      "created_at": "2024-11-01T10:00:00Z"
    }
  ]
}
```

#### POST /api/migrations/[id]/execute

Execute a migration.

**Authentication**: Required

**Path Parameters**:
- `id`: Migration ID

**Request Body**:
```json
{
  "dryRun": false,  // true for validation only
  "confirm": true   // required for actual execution
}
```

**Response (Success)**:
```json
{
  "success": true,
  "dryRun": false,
  "message": "Migration applied successfully",
  "executionTime": 250,
  "affectedRows": 5
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": "SQL execution failed: syntax error",
  "message": "Migration execution error: syntax error",
  "executionTime": 50
}
```

**Status Codes**:
- `200`: Success
- `400`: Bad request (missing confirmation, already applied, etc.)
- `401`: Unauthorized
- `403`: Access denied
- `404`: Migration not found
- `500`: Server error

---

### AI Features

#### POST /api/ai/explain

Generate AI explanation for a migration.

**Authentication**: Required

**Request Body**:
```json
{
  "scanReportId": "scan-report-id",
  "migrationId": "migration-id" // optional
}
```

**Response**:
```json
{
  "explanation": {
    "summary": "This migration adds a new column...",
    "description": "Detailed explanation...",
    "steps": ["Step 1", "Step 2"],
    "riskLevel": "medium",
    "dataLossRisk": false,
    "estimatedDowntime": 30,
    "recommendations": ["Rec 1", "Rec 2"],
    "rollbackPlan": "To rollback..."
  },
  "riskAssessment": {
    "severity": "medium",
    "dataLossRisk": false,
    "downtime": 30,
    "affectedRecords": 0
  }
}
```

#### POST /api/ai/query

Ask AI a question about a schema.

**Authentication**: Required

**Request Body**:
```json
{
  "question": "What's the safest way to apply this migration?",
  "scanReportId": "scan-report-id"
}
```

**Response**:
```json
{
  "answer": "AI-generated answer about the schema..."
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "message": "User-friendly message", // optional
  "details": {...} // optional, only in development
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Access denied |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server error |

---

## Rate Limiting

Currently no rate limiting implemented. Future versions will include:
- Rate limiting per user
- Rate limiting per project
- Rate limiting per IP

---

## Pagination

Currently all endpoints return all results. Future versions will support:
- `limit`: Number of results (default: 50)
- `offset`: Skip results
- `cursor`: Cursor-based pagination

---

## Examples

### Generate Migration

```bash
curl -X POST http://localhost:3000/api/migrations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "scanReportId": "scan-id",
    "format": "sql"
  }'
```

### Execute Migration

```bash
curl -X POST http://localhost:3000/api/migrations/migration-id/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "dryRun": false,
    "confirm": true
  }'
```

### Get Scan Reports

```bash
curl -X GET "http://localhost:3000/api/scans?projectId=project-id" \
  -H "Authorization: Bearer <token>"
```

---

## Next Steps

- 📖 [User Guide](./USER_GUIDE.md)
- 📖 [Migration Execution Guide](./MIGRATION_EXECUTION_GUIDE.md)
- 📖 [Troubleshooting Guide](../TROUBLESHOOTING.md)

