'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  /**
   * Format error message to be more user-friendly and actionable
   */
  function formatAuthError(error: any): { message: string; details: string | null } {
    const errorMessage = error?.message || 'An error occurred';
    
    // Map common Supabase errors to actionable messages
    if (errorMessage.includes('Invalid login credentials') || 
        errorMessage.includes('Email not confirmed') ||
        errorMessage.includes('Invalid email or password')) {
      return {
        message: 'Invalid email or password',
        details: 'Please check your credentials and try again. If you forgot your password, you can reset it.',
      };
    }
    
    if (errorMessage.includes('Email not confirmed')) {
      return {
        message: 'Email not confirmed',
        details: 'Please check your email and click the confirmation link before signing in.',
      };
    }
    
    if (errorMessage.includes('Too many requests')) {
      return {
        message: 'Too many login attempts',
        details: 'Please wait a few minutes before trying again. This helps protect your account.',
      };
    }
    
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return {
        message: 'Network error',
        details: 'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
      };
    }
    
    return {
      message: errorMessage,
      details: null,
    };
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const formatted = formatAuthError(error);
        setError(formatted.message);
        setErrorDetails(formatted.details);
        setLoading(false);
      } else {
        // Success - redirect to dashboard
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      // Handle unexpected errors
      const formatted = formatAuthError(err);
      setError(formatted.message || 'An unexpected error occurred');
      setErrorDetails('Please try again. If the problem persists, contact support.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to your Dev-Sync.dev account
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm space-y-1">
              <div className="font-medium">{error}</div>
              {errorDetails && (
                <div className="text-destructive/80 text-xs mt-1">{errorDetails}</div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link href="/auth/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

