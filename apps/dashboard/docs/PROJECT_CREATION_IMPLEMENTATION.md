# Project Creation Implementation

## Overview

The project creation flow has been enhanced to support full project details including codebase source (Git or File Upload).

## Features Implemented

### ✅ Form Fields
1. **Project Name** - Required, validated
2. **Schema Type** - Required, dropdown with 9 supported types
3. **Database Connection String** - Required, URI validated
4. **Codebase Source** - Required, radio selection:
   - Git Repository (with URL input)
   - File Upload (with file picker)

### ✅ Validation
- React Hook Form + Zod schema validation
- Real-time error messages
- Database connection string format validation
- Conditional validation based on codebase source type

### ✅ File Uploads
- Files uploaded to Supabase Storage bucket `project-files`
- Stored at path: `{projectId}/{filename}`
- Supports multiple files
- Status tracked in project config

### ✅ Git Cloning
- Background job system using `simple-git`
- Asynchronous cloning (non-blocking)
- Status updates: pending → processing → completed/failed
- Clone path stored in project config

### ✅ Status Tracking
- Real-time status updates via API endpoint
- UI component with polling for live updates
- Status indicators (pending, processing, completed, failed)

## File Structure

```
apps/dashboard/
├── components/
│   ├── NewProjectForm.tsx          # Enhanced form with all fields
│   └── CodebaseStatus.tsx          # Status display component
├── app/
│   ├── api/
│   │   └── projects/
│   │       ├── route.ts            # Project creation API
│   │       └── [id]/
│   │           └── codebase-status/
│   │               └── route.ts    # Status check API
│   └── dashboard/
│       └── projects/
│           ├── new/
│           │   └── page.tsx        # New project page
│           └── [id]/
│               └── page.tsx        # Project detail (with status)
└── docs/
    ├── SETUP_STORAGE.md            # Storage setup guide
    └── BACKGROUND_JOBS.md          # Background jobs documentation
```

## API Endpoints

### POST /api/projects
Creates a new project with codebase source.

**Request Body (JSON for Git):**
```json
{
  "name": "My Project",
  "slug": "my-project",
  "schemaType": "prisma",
  "dbConnectionString": "postgresql://...",
  "codebase": {
    "type": "git",
    "url": "https://github.com/user/repo.git"
  },
  "teamId": null
}
```

**Request Body (FormData for Upload):**
- `name`: string
- `slug`: string
- `schemaType`: string
- `dbConnectionString`: string
- `codebaseType`: "upload"
- `files`: File[] (multiple)
- `teamId`: string | null

### GET /api/projects/{id}/codebase-status
Returns current codebase processing status.

**Response:**
```json
{
  "status": "completed",
  "type": "git",
  "url": "https://github.com/user/repo.git",
  "uploadedFiles": [],
  "fileCount": 0,
  "error": null,
  "jobId": "git-clone-...",
  "clonedAt": "2024-11-11T..."
}
```

## Setup Required

### 1. Supabase Storage Bucket

Create a bucket named `project-files` in Supabase Dashboard:
- Go to Storage → New bucket
- Name: `project-files`
- Public: No (private)
- Set up RLS policies (see `SETUP_STORAGE.md`)

### 2. Environment Variables

Optional for Git cloning:
```env
PROJECTS_CLONE_DIR=/tmp/devsync-projects
```

## Usage Flow

1. User navigates to `/dashboard/projects/new`
2. Fills out form with all required fields
3. Selects codebase source (Git or Upload)
4. Submits form
5. **For Git:**
   - Project created immediately
   - Background job triggered to clone repository
   - Status updates shown in real-time
6. **For Upload:**
   - Files uploaded to Supabase Storage
   - Project created with file paths
   - Status updated immediately
7. User redirected to project dashboard
8. CodebaseStatus component shows processing status

## Status States

- `pending` - Waiting to process
- `processing` - Currently processing (cloning/uploading)
- `completed` - Successfully processed
- `failed` - Processing failed (error message shown)
- `not_configured` - No codebase source set

## Production Considerations

### Git Cloning
- Current implementation uses local file system (`/tmp`)
- For production, consider:
  - Cloud storage (S3, GCS) for cloned repos
  - Dedicated worker service
  - Job queue (Bull, BullMQ)
  - Supabase Edge Functions

### File Uploads
- Current implementation uses Supabase Storage
- For large files, consider:
  - Direct upload to cloud storage
  - Chunked uploads
  - Progress tracking

### Background Jobs
- Current implementation uses setTimeout (simulation)
- For production, use:
  - Job queues (Bull, BullMQ, etc.)
  - Supabase Edge Functions
  - Separate worker services

## Testing

1. **Test Git Repository:**
   - Create project with public Git URL
   - Verify status updates from pending → processing → completed
   - Check clone path in project config

2. **Test File Upload:**
   - Create project with file upload
   - Verify files appear in Supabase Storage
   - Check file paths in project config

3. **Test Error Handling:**
   - Invalid Git URL → should show failed status
   - Invalid file → should show error message
   - Network errors → should handle gracefully

## Next Steps

- [ ] Implement actual Git cloning (currently simulated)
- [ ] Add file processing/scanning after upload
- [ ] Add progress bars for file uploads
- [ ] Add retry mechanism for failed jobs
- [ ] Add job cancellation
- [ ] Add file preview/download
- [ ] Add Git authentication support (SSH keys, tokens)

