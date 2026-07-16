import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  buildCodebaseConfig,
  DEFAULT_PROJECT_LIMIT,
  formatProjectSummary,
  generateSlug,
  maskConnectionString,
  resolveUser,
  VALID_SCHEMA_TYPES,
} from './utils';
import { measurePerformance } from '@/lib/performance-monitor';
import { trackError } from '@/lib/error-tracking';
import { logger } from '@/lib/logger';
import { withRateLimit, addRateLimitHeaders } from '@/lib/rate-limit-middleware';
import { ensureGitClone, getProjectCloneDir, parseGitHubRepository } from '@/lib/codebase-storage';
import { getGitHubAccessTokenForRepository } from '@/lib/github-app';

export const dynamic = 'force-dynamic';

// Background function to clone Git repository
async function triggerGitClone(projectId: string, gitUrl: string, userId: string, supabase: any) {
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

    const cloneDir = getProjectCloneDir(projectId);

    logger.info(`Cloning Git repository for project ${projectId}`, {
      projectId,
      gitUrl,
      cloneDir,
    });

    const { owner, repository } = parseGitHubRepository(gitUrl);
    const accessToken = await getGitHubAccessTokenForRepository(userId, owner, repository);
    await ensureGitClone(projectId, gitUrl, null, accessToken);
    
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

      const adminSupabase = getAdminClient() as any;

      const { data: project, error: projectError } = await adminSupabase
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

      await triggerGitClone(projectId, gitUrl, user.id, adminSupabase);

      return NextResponse.json({
        success: true,
        message: 'GitHub repository processed',
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

    const requestedSlug = (slug?.trim() || generateSlug(name));

    const { codebaseConfig, validationError } = buildCodebaseConfig(codebase);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminClient() as any;
    let projectSlug = requestedSlug;
    let slugAvailable = false;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? requestedSlug : `${requestedSlug}-${attempt + 1}`;
      const { data: existingProject, error: slugCheckError } = await adminSupabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('slug', candidate)
        .maybeSingle();

      if (slugCheckError) {
        logger.error('Error checking project slug availability', slugCheckError, {
          userId: user.id,
          slug: candidate,
        });
        trackError(slugCheckError, {
          operation: 'POST /api/projects - check slug',
          userId: user.id,
          metadata: { slug: candidate },
        });
        return NextResponse.json(
          {
            error: 'Failed to create project',
            details: slugCheckError.message,
          },
          { status: 500 }
        );
      }

      if (!existingProject) {
        projectSlug = candidate;
        slugAvailable = true;
        break;
      }
    }

    if (!slugAvailable) {
      return NextResponse.json(
        {
          error: 'Failed to create project',
          details: 'Too many projects already use this slug. Please choose a more specific project name.',
        },
        { status: 409 }
      );
    }

    const { data: project, error: insertError } = await adminSupabase
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
        const storage = adminSupabase.storage.from('project-files');
        const uploadedFiles: string[] = [];

        for (const file of codebase.files) {
          if (!file || typeof file.arrayBuffer !== 'function') {
            continue;
          }
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

        await adminSupabase
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

        await adminSupabase
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
        await triggerGitClone(project.id, codebase.url, user.id, adminSupabase);
      }

      logger.info('Project created successfully', {
        userId: user.id,
        projectId: project.id,
        schemaType,
      });

      return NextResponse.json({
        success: true,
        project: {
          ...formatProjectSummary(project),
          slug: projectSlug,
          dbConnectionConfigured: !!project.db_connection_string,
          dbConnectionPreview: maskConnectionString(project.db_connection_string),
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
