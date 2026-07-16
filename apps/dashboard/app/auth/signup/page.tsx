'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import SchemaMeshBg from '@/components/animations/SchemaMeshBg';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

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
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  function formatAuthError(error: any): { message: string; details: string | null } {
    const errorMessage = error?.message || 'An error occurred';
    
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
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        const formatted = formatAuthError(error);
        setError(formatted.message);
        setErrorDetails(formatted.details);
        setLoading(false);
      } else {
        if (data.user && !data.session) {
          setSuccess(true);
          setError(null);
          setErrorDetails(null);
          setLoading(false);
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      }
    } catch (err) {
      const formatted = formatAuthError(err);
      setError(formatted.message || 'An unexpected error occurred');
      setErrorDetails('Please try again. If the problem persists, contact support.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative bg-background text-foreground transition-colors duration-300 overflow-hidden">
      
      {/* Floating Theme Button */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Floating Back Link */}
      <Link href="/" className="absolute top-6 left-6 z-50 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </Link>

      {/* Left Column: Form Card */}
      <div className="flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md space-y-8 glass-strong border border-border/50 p-8 rounded-2xl shadow-elevated bg-card/60 backdrop-blur-md">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Logo variant="original" width={48} height={48} />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Create account</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Sign up for DevSync to get started
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 p-4 rounded-xl text-xs space-y-1">
                <div className="font-semibold">Account created successfully!</div>
                <div className="text-green-600 dark:text-green-500 text-[11px] mt-1">
                  Please check your email to confirm your account before signing in.
                </div>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3.5 rounded-xl text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  {error}
                </div>
                {errorDetails && (
                  <div className="text-destructive/80 mt-1 pl-5">{errorDetails}</div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={success}
                  className="w-full px-4 py-2.5 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={success}
                  className="w-full px-4 py-2.5 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={success}
                  className="w-full px-4 py-2.5 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl gradient-primary text-primary-foreground border-0 hover:opacity-90 transition-opacity font-semibold" disabled={loading || success}>
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

          <div className="text-center text-sm pt-2">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/auth/login" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column: Schema animation mesh (Desktop only) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-secondary/20 relative border-l border-border/30">
        <SchemaMeshBg />
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <Logo variant="original" width={32} height={32} />
              <span className="font-display text-lg font-bold tracking-tight">
                DevSync<span className="text-gradient">.ai</span>
              </span>
            </div>
            <div className="max-w-md space-y-4 mt-20">
              <h2 className="text-4xl font-display font-bold leading-tight">
                Catch schema drift <span className="text-gradient">before it ships</span>
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connect your codebase migrations and live databases. Detect schema drift early, inspect interactive visual reports, generate AI safety scores, and apply fixes safely.
              </p>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-6 text-xs text-muted-foreground">
            <span>Read-only sync by default</span>
            <span>•</span>
            <span>Multi-level write protections</span>
          </div>
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
