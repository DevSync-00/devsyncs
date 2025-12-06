import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reporting/export
 * Export a report
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reportId, format, includeCharts, includeRawData, fileName } = body;

    if (!reportId || !format) {
      return NextResponse.json(
        { error: 'reportId and format are required' },
        { status: 400 }
      );
    }

    // Get report data (would be stored in database)
    // For now, generate on the fly
    const { data: report } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Verify access
    if (report.user_id !== user.id && report.team_id) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', report.team_id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Generate export based on format
    let exportData: any;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(report.data, null, 2);
        contentType = 'application/json';
        fileExtension = 'json';
        break;
      case 'csv':
        // Convert to CSV (simplified)
        exportData = convertToCSV(report.data);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'html':
        exportData = generateHTMLReport(report, includeCharts);
        contentType = 'text/html';
        fileExtension = 'html';
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        );
    }

    const finalFileName = fileName || `report-${reportId}.${fileExtension}`;

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${finalFileName}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function convertToCSV(data: any): string {
  // Simplified CSV conversion
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => row[h] || '').join(','));
    return [headers.join(','), ...rows].join('\n');
  }
  return JSON.stringify(data);
}

function generateHTMLReport(report: any, includeCharts: boolean): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${report.name || 'Report'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${report.name || 'Report'}</h1>
  <p>Generated: ${new Date(report.generated_at || Date.now()).toLocaleString()}</p>
  <div>
    ${JSON.stringify(report.data, null, 2)}
  </div>
</body>
</html>
  `;
}

