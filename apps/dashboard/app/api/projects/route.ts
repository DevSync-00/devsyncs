import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Background function to clone Git repository
async function triggerGitClone(projectId: string, gitUrl: string, supabase: any) {
  try {
    const jobId = `git-clone-${projectId}-${Date.now()}`;
    
    // Update project status to processing
    await supabase
      .from('projects')
      .update({
        config: {
          codebase: {
            type: 'git',
            url: gitUrl,
            status: 'processing',
            jobId,
            startedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', projectId);

    // Import simple-git dynamically
    const simpleGit = (await import('simple-git')).default;
    
    // Determine clone directory
    // In production, use a proper storage location (e.g., /tmp/projects or cloud storage)
    const cloneDir = process.env.PROJECTS_CLONE_DIR || `/tmp/devsync-projects/${projectId}`;
    
    // Ensure directory exists (in production, use proper file system utilities)
    const fs = await import('fs/promises');
    try {
      await fs.mkdir(cloneDir, { recursive: true });
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
    
    // Clone the repository
    console.log(`[Background Job] Cloning Git repository for project ${projectId}: ${gitUrl}`);
    const git = simpleGit();
    
    await git.clone(gitUrl, cloneDir, {
      '--depth': '1', // Shallow clone for faster cloning
    });
    
    // Store clone path in config (in production, you might upload to cloud storage)
    await supabase
      .from('projects')
      .update({
        config: {
          codebase: {
            type: 'git',
            url: gitUrl,
            status: 'completed',
            jobId,
            clonedAt: new Date().toISOString(),
            clonePath: cloneDir, // Store path for later use
          },
        },
      })
      .eq('id', projectId);
    
    console.log(`[Background Job] Successfully cloned repository to ${cloneDir}`);
    
  } catch (error: any) {
    console.error('Error in Git clone job:', error);
    
    // Update project status to failed
    await supabase
      .from('projects')
      .update({
        config: {
          codebase: {
            type: 'git',
            url: gitUrl,
            status: 'failed',
            error: error.message || 'Failed to clone repository',
            failedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', projectId);
  }
}

// GET: Fetch user's projects
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's projects
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: authError.message 
        },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.error('No user found in session');
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: 'No user session found. Please log in again.' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Handle Git clone trigger action (called from client after project creation)
    if (body.action === 'trigger-git-clone') {
      const { projectId, gitUrl } = body;
      
      if (!projectId || !gitUrl) {
        return NextResponse.json(
          { error: 'projectId and gitUrl are required' },
          { status: 400 }
        );
      }
      
      // Verify project exists and user has access
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, user_id')
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      
      if (project.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
      
      // Trigger Git clone asynchronously
      triggerGitClone(projectId, gitUrl, supabase).catch((error) => {
        console.error('Error triggering Git clone:', error);
      });
      
      return NextResponse.json({
        success: true,
        message: 'Git clone job triggered',
      });
    }
    
    // Original project creation flow (for backward compatibility)
    const {
      name,
      slug,
      schemaType,
      dbConnectionString,
      codebase,
      teamId,
    } = body;

    // Validate required fields
    if (!name || !slug || !schemaType || !dbConnectionString || !codebase) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate schema type
    const validSchemaTypes = [
      'prisma',
      'supabase',
      'typeorm',
      'kysely',
      'sequelize',
      'drizzle',
      'django',
      'sqlalchemy',
      'raw-sql'
    ];
    
    if (!validSchemaTypes.includes(schemaType)) {
      return NextResponse.json(
        { error: 'Invalid schema type' },
        { status: 400 }
      );
    }

    // Handle codebase source
    let codebaseConfig: any = {
      type: codebase.type,
    };

    if (codebase.type === 'git') {
      if (!codebase.url) {
        return NextResponse.json(
          { error: 'Git URL is required' },
          { status: 400 }
        );
      }
      
      // Validate Git URL format
      try {
        const url = new URL(codebase.url);
        if (!['http:', 'https:', 'git:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid Git URL format' },
          { status: 400 }
        );
      }

      codebaseConfig.url = codebase.url;
      codebaseConfig.status = 'pending'; // Will be cloned asynchronously
      
      // Queue Git clone job
      // We'll trigger it asynchronously after project creation
      codebaseConfig.jobId = `git-clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
    } else if (codebase.type === 'upload') {
      // Handle file uploads
      const files = codebase.files || [];
      
      if (files.length === 0) {
        return NextResponse.json(
          { error: 'No files uploaded' },
          { status: 400 }
        );
      }

      codebaseConfig.status = 'pending';
      codebaseConfig.fileCount = files.length;
    }

    // Create project in database first (we need the project ID for file paths)
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        name,
        slug,
        user_id: user.id,
        team_id: teamId || null,
        schema_type: schemaType,
        db_connection_string: dbConnectionString,
        config: {
          codebase: codebaseConfig,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating project:', insertError);
      return NextResponse.json(
        { 
          error: 'Failed to create project',
          details: insertError.message 
        },
        { status: 500 }
      );
    }

    // Handle file uploads after project creation
    if (codebase.type === 'upload' && codebase.files) {
      try {
        const storage = supabase.storage.from('project-files');
        const uploadedFiles: string[] = [];
        
        // Upload each file to Supabase Storage
        for (const file of codebase.files) {
          const filePath = `${project.id}/${file.name}`;
          
          // Convert File to ArrayBuffer for Supabase Storage
          const arrayBuffer = await file.arrayBuffer();
          const { error: uploadError } = await storage.upload(filePath, arrayBuffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
          
          if (uploadError) {
            console.error(`Error uploading file ${file.name}:`, uploadError);
            // Continue with other files even if one fails
          } else {
            uploadedFiles.push(filePath);
          }
        }
        
        // Update project config with uploaded file paths
        codebaseConfig.status = uploadedFiles.length > 0 ? 'completed' : 'failed';
        codebaseConfig.uploadedFiles = uploadedFiles;
        
        await supabase
          .from('projects')
          .update({
            config: {
              codebase: codebaseConfig,
            },
          })
          .eq('id', project.id);
      } catch (error: any) {
        console.error('Error uploading files:', error);
        // Don't fail the project creation, just log the error
        codebaseConfig.status = 'failed';
        codebaseConfig.error = error.message;
        
        await supabase
          .from('projects')
          .update({
            config: {
              codebase: codebaseConfig,
            },
          })
          .eq('id', project.id);
      }
    }

    // Trigger background job for Git cloning if needed (after project is created)
    if (codebase.type === 'git' && codebase.url) {
      // Trigger Git clone asynchronously (don't await to avoid blocking)
      triggerGitClone(project.id, codebase.url, supabase).catch((error) => {
        console.error('Error triggering Git clone:', error);
      });
    }
    
    return NextResponse.json({
      success: true,
      project: {
        ...project,
        config: {
          ...project.config,
          codebase: codebaseConfig,
        },
      },
      message: 'Project created successfully',
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
