# Background Jobs Implementation

## Overview

DevSync uses background jobs to handle:
1. **Git Repository Cloning** - Clones Git repositories asynchronously
2. **File Processing** - Processes uploaded files

## Current Implementation

### Git Cloning

The Git cloning is handled in `apps/dashboard/app/api/projects/route.ts`:

- Uses `simple-git` library for Git operations
- Clones repositories to `/tmp/devsync-projects/{projectId}`
- Updates project status in real-time (pending → processing → completed/failed)

### File Uploads

File uploads are handled synchronously:
- Files are uploaded to Supabase Storage bucket `project-files`
- Stored at path: `{projectId}/{filename}`
- Status updated immediately after upload

## Production Recommendations

### Option 1: Supabase Edge Functions (Recommended)

Create Edge Functions for background processing:

```typescript
// supabase/functions/clone-git-repo/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { projectId, gitUrl } = await req.json()
  
  // Clone repository
  // Update project status
  // Return success
})
```

### Option 2: Job Queue (Bull/BullMQ)

For more complex job processing:

```bash
npm install bullmq ioredis
```

```typescript
// lib/jobs/git-clone.ts
import { Queue } from 'bullmq';

const gitCloneQueue = new Queue('git-clone', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export async function queueGitClone(projectId: string, gitUrl: string) {
  await gitCloneQueue.add('clone', { projectId, gitUrl });
}
```

### Option 3: Separate Worker Service

Run a dedicated Node.js worker service:

```typescript
// worker/src/index.ts
import { Queue, Worker } from 'bullmq';

const worker = new Worker('git-clone', async (job) => {
  const { projectId, gitUrl } = job.data;
  // Clone repository
  // Update database
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});
```

## Status Tracking

Project codebase status is stored in `projects.config.codebase`:

```typescript
{
  type: 'git' | 'upload',
  status: 'pending' | 'processing' | 'completed' | 'failed',
  url?: string, // Git URL
  uploadedFiles?: string[], // File paths
  error?: string, // Error message if failed
  jobId?: string, // Job identifier
  clonedAt?: string, // ISO timestamp
}
```

## API Endpoints

### Check Status
```
GET /api/projects/{id}/codebase-status
```

Returns current codebase processing status.

## Monitoring

- Check project config for status updates
- Use CodebaseStatus component for real-time UI updates
- Poll status endpoint every 2 seconds when processing

