import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildCodebaseConfig,
  DEFAULT_PROJECT_LIMIT,
  formatProjectSummary,
  generateSlug,
  resolveUser,
  VALID_SCHEMA_TYPES,
} from './utils';

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
    const user = await resolveUser(request, supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim();
    const limitParam = Number.parseInt(searchParams.get('limit') || '', 10);
    const limit = Number.isNaN(limitParam)
      ? DEFAULT_PROJECT_LIMIT
      : Math.max(1, Math.min(limitParam, 100));

    let query = supabase
      .from('projects')
      .select('id, name, slug, schema_type, created_at, updated_at, team_id, config')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      const pattern = `%${search.replace(/[%_]/g, '\\$&')}%`;
      query = query.ilike('name', pattern);
    }

    const { data: projects, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    const projectIds = projects?.map((project) => project.id) || [];
    const latestScanMap = new Map<string, any>();

    if (projectIds.length > 0) {
      const { data: scans, error: scansError } = await supabase
        .from('scan_reports')
        .select('id, project_id, status, created_at, mismatches')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (!scansError && scans) {
        for (const scan of scans) {
          if (!latestScanMap.has(scan.project_id)) {
            latestScanMap.set(scan.project_id, scan);
          }
        }
      }
    }

    const projectsWithMeta = (projects || []).map((project) =>
      formatProjectSummary(project, latestScanMap.get(project.id))
    );

    return NextResponse.json({ projects: projectsWithMeta });
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
    const user = await resolveUser(request, supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (body.action === 'trigger-git-clone') {
      const { projectId, gitUrl } = body;

      if (!projectId || !gitUrl) {
        return NextResponse.json(
          { error: 'projectId and gitUrl are required' },
          { status: 400 }
        );
      }

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

      triggerGitClone(projectId, gitUrl, supabase).catch((error) => {
        console.error('Error triggering Git clone:', error);
      });

      return NextResponse.json({
        success: true,
        message: 'Git clone job triggered',
      });
    }

    const {
      name,
      slug,
      schemaType,
      dbConnectionString,
      codebase,
      teamId,
    } = body;

    if (!name || !schemaType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!VALID_SCHEMA_TYPES.includes(schemaType)) {
      return NextResponse.json(
        { error: 'Invalid schema type' },
        { status: 400 }
      );
    }

    const projectSlug = (slug?.trim() || generateSlug(name));

    const { codebaseConfig, validationError } = buildCodebaseConfig(codebase);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        name,
        slug: projectSlug,
        user_id: user.id,
        team_id: teamId || null,
        schema_type: schemaType,
        db_connection_string: dbConnectionString || null,
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
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    if (codebase?.type === 'upload' && codebase.files) {
      try {
        const storage = supabase.storage.from('project-files');
        const uploadedFiles: string[] = [];

        for (const file of codebase.files) {
          const filePath = `${project.id}/${file.name}`;
          const arrayBuffer = await file.arrayBuffer();
          const { error: uploadError } = await storage.upload(filePath, arrayBuffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

          if (uploadError) {
            console.error(`Error uploading file ${file.name}:`, uploadError);
          } else {
            uploadedFiles.push(filePath);
          }
        }

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

    if (codebase?.type === 'git' && codebase.url) {
      triggerGitClone(project.id, codebase.url, supabase).catch((error) => {
        console.error('Error triggering Git clone:', error);
      });
    }

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        slug: projectSlug,
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
        details: error.message,
      },
      { status: 500 }
    );
  }
}
