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
import { measurePerformance } from '@/lib/performance-monitor';
import { trackError } from '@/lib/error-tracking';
import { logger } from '@/lib/logger';
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limit-middleware';

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
    const baseDir = process.env.PROJECTS_CLONE_DIR || `/tmp/devsync-projects`;
    const cloneDir = `${baseDir}/${projectId}`;
    
    // Import file system utilities
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Check if directory exists and clean it up if needed
    try {
      const stats = await fs.stat(cloneDir);
      if (stats.isDirectory()) {
        // Directory exists - check if it's empty
        const contents = await fs.readdir(cloneDir);
        if (contents.length > 0) {
          // Directory is not empty - remove it to allow fresh clone
          logger.info(`Removing existing non-empty directory: ${cloneDir}`, {
            projectId,
            contentsCount: contents.length,
          });
          await fs.rm(cloneDir, { recursive: true, force: true });
        }
      }
    } catch (err: any) {
      // Directory doesn't exist - that's fine, we'll create it
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    
    // Ensure parent directory exists
    await fs.mkdir(baseDir, { recursive: true });
    
    // Clone the repository
    logger.info(`Cloning Git repository for project ${projectId}`, {
      projectId,
      gitUrl,
      cloneDir,
    });
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
    
    logger.info(`Successfully cloned repository to ${cloneDir}`, {
      projectId,
      cloneDir,
    });
    
  } catch (error: any) {
    logger.error('Error in Git clone job', error, {
      projectId,
      gitUrl,
    });
    trackError(error, {
      operation: 'triggerGitClone',
      projectId,
      metadata: { gitUrl },
    });
    
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
  return withRateLimit(async (req: NextRequest) => {
    return measurePerformance('GET /api/projects', async () => {
    let user: any = null;
    try {
      const supabase = await createClient();
      user = await resolveUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
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
      logger.error('GET /api/projects failed', error instanceof Error ? error : new Error(String(error)), {
        userId: user?.id,
      });
      trackError(error, {
        operation: 'GET /api/projects',
        userId: user?.id,
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
  })(request);
}

// POST: Create a new project
export async function POST(request: NextRequest) {
  return withRateLimit(async (req: NextRequest) => {
    return measurePerformance('POST /api/projects', async () => {
    let user: any = null;
    try {
      const supabase = await createClient();
      user = await resolveUser(req, supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

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
        logger.error('Error triggering Git clone', error, {
          userId: user.id,
          projectId,
        });
        trackError(error, {
          operation: 'POST /api/projects - trigger git clone',
          userId: user.id,
          projectId,
        });
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
        logger.error('Error creating project', insertError, {
          userId: user.id,
          schemaType,
        });
        trackError(insertError, {
          operation: 'POST /api/projects',
          userId: user.id,
          metadata: { schemaType },
        });
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

        if (codebaseConfig) {
          (codebaseConfig as any).status = uploadedFiles.length > 0 ? 'completed' : 'failed';
          (codebaseConfig as any).uploadedFiles = uploadedFiles;
        }

        await supabase
          .from('projects')
          .update({
            config: {
              codebase: codebaseConfig,
            },
          })
          .eq('id', project.id);
      } catch (error: any) {
        logger.error('Error uploading files', error, {
          userId: user.id,
          projectId: project.id,
        });
        trackError(error, {
          operation: 'POST /api/projects - file upload',
          userId: user.id,
          projectId: project.id,
        });
        if (codebaseConfig) {
          (codebaseConfig as any).status = 'failed';
          (codebaseConfig as any).error = error.message;
        }

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
          logger.error('Error triggering Git clone', error, {
            userId: user.id,
            projectId: project.id,
          });
          trackError(error, {
            operation: 'POST /api/projects - git clone',
            userId: user.id,
            projectId: project.id,
          });
        });
      }

      logger.info('Project created successfully', {
        userId: user.id,
        projectId: project.id,
        schemaType,
      });

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
      logger.error('POST /api/projects failed', error, {
        userId: user?.id,
      });
      trackError(error, {
        operation: 'POST /api/projects',
        userId: user?.id,
      });
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error.message,
        },
        { status: 500 }
      );
    }
  });
  })(request);
}
