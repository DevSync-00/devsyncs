/**
 * Next.js instrumentation file
 * Runs once when the server starts
 * Used to initialize error tracking and performance monitoring
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side initialization
    const { initErrorTracking } = await import('./lib/error-tracking');
    
    // Initialize error tracking if DSN is provided
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
    if (sentryDsn) {
      initErrorTracking(sentryDsn);
    } else {
      // Initialize without Sentry (console logging only)
      initErrorTracking();
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime initialization (if needed)
  }
}

