# API Reference

Complete API reference for DevSync.AI Dashboard API endpoints.

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

Get all projects for the authenticated user.

**Authentication**: Required

**Response**:
```json
{
  "projects": [
    {
      "id": "project-id",
      "name": "My Project",
      "slug": "my-project",
      "user_id": "user-id",
      "schema_type": "prisma",
      "created_at": "2024-11-01T10:00:00Z"
    }
  ]
}
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

