# Supabase Storage Setup

## Create Storage Bucket for Project Files

To enable file uploads for projects, you need to create a Supabase Storage bucket.

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click on **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **New bucket**
   - Name: `project-files`
   - Public: **No** (private bucket)
   - File size limit: Set appropriate limit (e.g., 100MB)
   - Allowed MIME types: Leave empty or specify allowed types

3. **Set Up RLS Policies**

Run this SQL in Supabase SQL Editor:

```sql
-- Allow authenticated users to upload files to their own project folders
CREATE POLICY "Users can upload to own projects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE user_id = auth.uid()
    )
  );

-- Allow users to read files from their own projects
CREATE POLICY "Users can read own project files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE user_id = auth.uid()
    )
  );

-- Allow users to delete files from their own projects
CREATE POLICY "Users can delete own project files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE user_id = auth.uid()
    )
  );
```

### File Structure

Files are stored with the following structure:
```
project-files/
  └── {project-id}/
      ├── file1.ts
      ├── file2.ts
      └── ...
```

### Environment Variables

For Git cloning, you may want to set:

```env
# Optional: Custom directory for cloned repositories
PROJECTS_CLONE_DIR=/tmp/devsync-projects
```

**Note:** In production, consider using:
- Cloud storage (S3, GCS) for file uploads
- A dedicated worker service for Git cloning
- Job queues (Bull, BullMQ) for background processing

