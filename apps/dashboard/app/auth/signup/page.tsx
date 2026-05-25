'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Pre-fill email from query param if present
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  /**
   * Format error message to be more user-friendly and actionable
   */
  function formatAuthError(error: any): { message: string; details: string | null } {
    const errorMessage = error?.message || 'An error occurred';
    
    // Map common Supabase errors to actionable messages
    if (errorMessage.includes('User already registered') || 
        errorMessage.includes('already registered')) {
      return {
        message: 'An account with this email already exists',
        details: 'Please sign in instead, or use a different email address.',
      };
    }
    
    if (errorMessage.includes('Password')) {
      return {
        message: 'Password requirements not met',
        details: 'Password must be at least 6 characters long.',
      };
    }
    
    if (errorMessage.includes('Email')) {
      return {
        message: 'Invalid email address',
        details: 'Please enter a valid email address.',
      };
    }
    
    if (errorMessage.includes('Too many requests')) {
      return {
        message: 'Too many signup attempts',
        details: 'Please wait a few minutes before trying again.',
      };
    }
    
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return {
        message: 'Network error',
        details: 'Please check your internet connection and try again.',
      };
    }
    
    return {
      message: errorMessage,
      details: null,
    };
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setSuccess(false);

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setErrorDetails('Please make sure both password fields match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setErrorDetails('Please choose a password that is at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        const formatted = formatAuthError(error);
        setError(formatted.message);
        setErrorDetails(formatted.details);
        setLoading(false);
      } else {
        // Check if email confirmation is required
        if (data.user && !data.session) {
          setSuccess(true);
          setError(null);
          setErrorDetails(null);
          setLoading(false);
        } else {
          // Auto-logged in, redirect
          router.push('/dashboard');
          router.refresh();
        }
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
          <h1 className="text-3xl font-bold">Create account</h1>
          <p className="text-muted-foreground mt-2">
            Sign up for Dev-Sync.dev to get started
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-md text-sm space-y-1">
              <div className="font-medium">Account created successfully!</div>
              <div className="text-green-600 dark:text-green-500 text-xs mt-1">
                Please check your email to confirm your account before signing in.
              </div>
            </div>
          )}
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading || success}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Sign up'
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
