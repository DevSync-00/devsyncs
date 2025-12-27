import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { runAnalyticsBackgroundJobs } from '@/lib/analytics/background-jobs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/background-jobs
 * 
 * Run analytics background jobs (stability calculation, cleanup, aggregation).
 * 
 * This endpoint should be called from a cron job or scheduled task.
 * Requires service role authentication or a secret key.
 */
export async function POST(request: NextRequest) {
  try {
    // Check for secret key (for cron jobs)
    const authHeader = request.headers.get('authorization');
    const secretKey = process.env.ANALYTICS_CRON_SECRET;
    
    if (secretKey && authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get admin Supabase client (service role)
    const supabase = createClient();
    
    // Parse request body for job selection
    const body = await request.json().catch(() => ({}));
    const jobs = body.jobs || ['stability']; // Default to stability calculation

    // Run background jobs
    const result = await runAnalyticsBackgroundJobs(supabase, jobs);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: result.results,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Background jobs error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/background-jobs
 * 
 * Get status of background jobs (last run time, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    // This would typically check a jobs table or cache
    // For now, return a simple status
    return NextResponse.json({
      status: 'active',
      jobs: {
        stability: {
          description: 'Calculate stability scores for all projects',
          schedule: 'Daily at 2 AM',
        },
        cleanup: {
          description: 'Clean up old analytics data',
          schedule: 'Weekly on Sunday at 3 AM',
        },
        aggregate: {
          description: 'Aggregate daily team activity',
          schedule: 'Daily at 1 AM',
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

