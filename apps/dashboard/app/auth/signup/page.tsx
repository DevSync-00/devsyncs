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
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import GitHubAuthButton from '@/components/auth/GitHubAuthButton';
import { getAuthCallbackUrl } from '@/lib/auth/callback-url';

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
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      if (error) {
        const formatted = formatAuthError(error);
        setError(formatted.message);
        setErrorDetails(formatted.details);
        setLoading(false);
      } else {
        if (data.user && !data.user.email_confirmed_at) {
          if (data.session) {
            await supabase.auth.signOut();
          }
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
      {/* Left Column: Form Container */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 relative z-10 bg-muted/20 dark:bg-background transition-colors duration-300 min-h-screen">
        {/* Top Header Controls Bar (Positioned Above Form Card - No Overlap!) */}
        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-all bg-card/90 dark:bg-card/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/80 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-md space-y-7 border border-border/80 p-8 rounded-2xl shadow-xl bg-card transition-colors duration-300">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <Logo variant="original" width={48} height={48} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
              Create account
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Sign up for DevSync to get started
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl text-xs space-y-1 shadow-sm">
                <div className="font-semibold">Account created successfully!</div>
                <div className="text-emerald-600 dark:text-emerald-500 text-[11px] mt-1 leading-relaxed">
                  Please check your email to confirm your account before signing in.
                </div>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3.5 rounded-xl text-xs space-y-1 shadow-sm">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  {error}
                </div>
                {errorDetails && (
                  <div className="text-destructive/90 mt-1 pl-5 text-[11px] leading-relaxed">{errorDetails}</div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground font-mono">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={success}
                  className="w-full px-4 py-2.5 bg-background/80 dark:bg-muted/40 border border-border/80 text-foreground placeholder:text-muted-foreground/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/80 focus:border-primary transition-all font-mono text-sm shadow-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground font-mono">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={success}
                  className="w-full px-4 py-2.5 bg-background/80 dark:bg-muted/40 border border-border/80 text-foreground placeholder:text-muted-foreground/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/80 focus:border-primary transition-all font-mono text-sm shadow-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-muted-foreground font-mono">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={success}
                  className="w-full px-4 py-2.5 bg-background/80 dark:bg-muted/40 border border-border/80 text-foreground placeholder:text-muted-foreground/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/80 focus:border-primary transition-all font-mono text-sm shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold shadow-md shadow-primary/20 flex items-center justify-center gap-2" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Sign up'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
              <span className="bg-card px-3 text-muted-foreground font-semibold">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <GoogleAuthButton
              label="Sign up with Google"
              onError={(message) => {
                setError(message);
                setErrorDetails(message ? 'Please try again or create an account with email.' : null);
              }}
            />
            <GitHubAuthButton
              label="Sign up with GitHub"
              onError={(message) => {
                setError(message);
                setErrorDetails(message ? 'Please try again or create an account with email.' : null);
              }}
            />
          </div>

          <div className="text-center text-xs pt-2">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/auth/login" className="text-primary hover:underline font-semibold font-mono">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column: Schema animation mesh (Desktop only) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/5 via-card to-secondary/30 dark:from-card dark:via-background dark:to-primary/10 relative border-l border-border/40">
        <SchemaMeshBg />
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <Logo variant="original" width={32} height={32} />
                <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                  dev-sync
                </span>
              </div>
              <ThemeToggle />
            </div>

            <div className="max-w-md space-y-4 mt-16">
              <h2 className="text-3xl lg:text-4xl font-display font-bold leading-tight text-foreground">
                Catch schema drift <span className="text-primary">before it ships</span>
              </h2>
              <p className="text-muted-foreground text-xs lg:text-sm leading-relaxed">
                Connect your codebase migrations and live databases. Detect schema drift early, inspect interactive visual reports, generate AI safety scores, and apply fixes safely.
              </p>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-6 text-xs text-muted-foreground font-mono">
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
