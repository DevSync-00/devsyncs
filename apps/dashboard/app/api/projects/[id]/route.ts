import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  buildCodebaseConfig,
  formatProjectSummary,
  generateSlug,
  maskConnectionString,
  resolveUser,
} from '../utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const schemaTypeEnum = z.enum([
  'prisma',
  'supabase',
  'typeorm',
  'kysely',
  'sequelize',
  'drizzle',
  'django',
  'sqlalchemy',
  'raw-sql',
]);

const codebaseSchema = z.object({
  type: z.enum(['git', 'upload', 'cli']),
  url: z.string().url().optional(),
  status: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  schemaType: schemaTypeEnum.optional(),
  dbConnectionString: z
    .union([z.string().min(1), z.literal('')])
    .optional(),
  codebase: codebaseSchema.nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRateLimit(async (req: NextRequest) => {
    try {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project, error } = await fetchProjectWithAccess(supabase, params.id, user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { data: latestScan } = await supabase
      .from('scan_reports')
      .select('id, status, created_at, mismatches')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      project: {
        ...formatProjectSummary(project, latestScan || undefined),
        dbConnectionConfigured: !!project.db_connection_string,
        dbConnectionPreview: maskConnectionString(project.db_connection_string),
        config: project.config,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  })(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRateLimit(async (req: NextRequest) => {
    try {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project, error } = await fetchProjectWithAccess(supabase, params.id, user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const payload = updateSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || 'Invalid payload' },
        { status: 400 }
      );
    }

    const data = payload.data;
    const updates: Record<string, any> = {};

    if (data.name) {
      updates.name = data.name;
      updates.slug = generateSlug(data.name);
    }

    if (data.schemaType) {
      updates.schema_type = data.schemaType;
    }

    if (data.dbConnectionString !== undefined) {
      updates.db_connection_string = data.dbConnectionString === '' ? null : data.dbConnectionString;
    }

    if (data.codebase !== undefined) {
      const { codebaseConfig, validationError } = buildCodebaseConfig(data.codebase || undefined);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
      updates.config = {
        ...(project.config || {}),
        codebase: codebaseConfig,
      };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError || !updatedProject) {
      console.error('Update project error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      );
    }

    const { data: latestScan } = await supabase
      .from('scan_reports')
      .select('id, status, created_at, mismatches')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      project: {
        ...formatProjectSummary(updatedProject, latestScan || undefined),
        dbConnectionConfigured: !!updatedProject.db_connection_string,
        dbConnectionPreview: maskConnectionString(updatedProject.db_connection_string),
        config: updatedProject.config,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  })(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRateLimit(async (req: NextRequest) => {
    try {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await fetchProjectWithAccess(supabase, params.id, user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Delete project error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  })(request);
}

async function fetchProjectWithAccess(supabase: any, projectId: string, userId: string) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, slug, schema_type, db_connection_string, config, team_id, user_id, created_at, updated_at')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return {
      error: {
        status: 404,
        message: 'Project not found',
      },
    };
  }

  const isOwner = project.user_id === userId;
  let hasTeamAccess = false;

  if (project.team_id) {
    const { data: isMember } = await supabase
      .rpc('check_team_membership', { team_uuid: project.team_id });
    hasTeamAccess = !!isMember;
  }

  if (!isOwner && !hasTeamAccess) {
    return {
      error: {
        status: 403,
        message: 'Access denied',
      },
    };
  }

  return { project };
}

