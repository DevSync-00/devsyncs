import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, user_id, team_id, config').eq('id', params.id).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    let allowed = project.user_id === user.id;
    if (!allowed && project.team_id) {
      const { data } = await supabase.rpc('check_team_membership', { team_uuid: project.team_id });
      allowed = Boolean(data);
    }
    if (!allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { data, error } = await supabase
      .from('pull_request_reviews')
      .select('*, scan_report:scan_reports(id, created_at, metadata)')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(12);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const repositoryUrl = project.config?.codebase?.url as string | undefined;
    const repository = repositoryUrl?.match(/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/i)?.[1] || null;
    let jobs: any[] = [];
    if (repository) {
      const admin = getAdminClient() as any;
      const { data: jobRows } = await admin
        .from('background_jobs')
        .select('id, status, progress, attempts, max_attempts, last_error, payload, created_at, updated_at')
        .eq('job_type', 'github_pr_review')
        .eq('payload->>repository', repository)
        .in('status', ['queued', 'running', 'retry', 'dead'])
        .order('created_at', { ascending: false })
        .limit(10);
      jobs = (jobRows || []).map((job: any) => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        error: job.status === 'dead' ? job.last_error : null,
        pullNumber: job.payload?.pullNumber,
        headSha: job.payload?.headSha,
        createdAt: job.created_at,
      }));
    }
    return NextResponse.json({ reviews: data || [], jobs });
  })(request);
}
