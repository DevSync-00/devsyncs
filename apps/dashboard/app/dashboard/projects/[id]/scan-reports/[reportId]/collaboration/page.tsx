import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CommentsSection from '@/components/collaboration/CommentsSection';
import ShareScanResult from '@/components/collaboration/ShareScanResult';

export default async function ScanReportCollaborationPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Verify scan report access
  const { data: scanReport, error: scanError } = await supabase
    .from('scan_reports')
    .select('*, projects(id, name, user_id, team_id)')
    .eq('id', params.reportId)
    .single();

  if (scanError || !scanReport) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <Link href={`/dashboard/projects/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
        </Link>
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">Scan report not found</p>
        </div>
      </div>
    );
  }

  const project = scanReport.projects as any;
  const isOwner = project.user_id === user.id;

  // Check team access
  let hasTeamAccess = false;
  if (project.team_id) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    hasTeamAccess = !!membership;
  }

  // Check if shared with user
  const { data: share } = await supabase
    .from('shared_scan_results')
    .select('permissions')
    .eq('scan_report_id', params.reportId)
    .or(`shared_with.eq.${user.id},share_type.eq.public`)
    .single();

  const hasAccess = isOwner || hasTeamAccess || !!share;

  if (!hasAccess) {
    redirect('/dashboard/projects');
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <Link href={`/dashboard/projects/${params.id}/scan-reports/${params.reportId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Scan Report
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mt-4">Collaboration</h1>
        <p className="text-muted-foreground mt-2">
          Comments, sharing, and collaboration for this scan report
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <CommentsSection scanReportId={params.reportId} />
        </div>
        <div className="space-y-6">
          <ShareScanResult scanReportId={params.reportId} />
        </div>
      </div>
    </div>
  );
}

