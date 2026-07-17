'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import SchemaMeshBg from '@/components/animations/SchemaMeshBg';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import GitHubAuthButton from '@/components/auth/GitHubAuthButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get('message');
    if (message) {
      setError('Social sign-in failed');
      setErrorDetails(message);
    }
  }, []);

  function formatAuthError(error: any): { message: string; details: string | null } {
    const errorMessage = error?.message || 'An error occurred';
    
    if (errorMessage.includes('Email not confirmed')) {
      return {
        message: 'Email not verified',
        details: 'Please check your email and click the verification link before signing in.',
      };
    }

    if (errorMessage.includes('Invalid login credentials') ||
        errorMessage.includes('Invalid email or password')) {
      return {
        message: 'Invalid email or password',
        details: 'Please check your credentials and try again. If you forgot your password, you can reset it.',
      };
    }
    
    if (errorMessage.includes('Too many requests')) {
      return {
        message: 'Too many login attempts',
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const formatted = formatAuthError(error);
        setError(formatted.message);
        setErrorDetails(formatted.details);
        setLoading(false);
      } else if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setError('Email not verified');
        setErrorDetails('Please check your email and click the verification link before signing in.');
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
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
            <h1 className="text-3xl font-display font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Sign in to your DevSync account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
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
                  className="w-full px-4 py-2.5 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-card/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl gradient-primary text-primary-foreground border-0 hover:opacity-90 transition-opacity font-semibold" disabled={loading}>
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <GoogleAuthButton
              label="Sign in with Google"
              onError={(message) => {
                setError(message);
                setErrorDetails(message ? 'Please try again or use your email and password.' : null);
              }}
            />
            <GitHubAuthButton
              label="Sign in with GitHub"
              onError={(message) => {
                setError(message);
                setErrorDetails(message ? 'Please try again or use your email and password.' : null);
              }}
            />
          </div>

          <div className="text-center text-sm pt-2">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/auth/signup" className="text-primary hover:underline font-semibold">
              Sign up
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
                Dev-<span className="text-gradient">Sync</span>
              </span>
            </div>
            <div className="max-w-md space-y-4 mt-20">
              <h2 className="text-4xl font-display font-bold leading-tight">
                Align code & database schema <span className="text-gradient">safely</span>
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
