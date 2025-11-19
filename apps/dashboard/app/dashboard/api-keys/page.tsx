'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Copy, Check, Key, FolderKanban } from 'lucide-react';
import Link from 'next/link';

export default function APIKeysPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        // Get access token from session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          setAccessToken(session.access_token);
        }

        // Fetch projects
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: projectsData } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          setProjects(projectsData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">API Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Use these values to configure the DevSync VSCode extension
        </p>
      </div>

      {/* Access Token */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Access Token (JWT)</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This is your personal access token. Use it for <code className="text-xs bg-muted px-1 py-0.5 rounded">devsync.apiKey</code> in VSCode settings.
        </p>
        {accessToken ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                {accessToken}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(accessToken, 'token')}
              >
                {copied === 'token' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-yellow-500">
              ⚠️ This token expires. If the extension stops working, refresh this page to get a new token.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-500 text-sm">
            No active session. Please log in to get your access token.
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <FolderKanban className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Your Projects</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Use a Project ID for <code className="text-xs bg-muted px-1 py-0.5 rounded">devsync.projectId</code> in VSCode settings.
        </p>
        {projects.length > 0 ? (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 bg-muted/50 rounded border border-border"
              >
                <div className="flex-1">
                  <div className="font-semibold">{project.name}</div>
                  <div className="text-sm text-muted-foreground font-mono mt-1">
                    {project.id}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(project.id, project.id)}
                  >
                    {copied === project.id ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy ID
                      </>
                    )}
                  </Button>
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-muted rounded text-center">
            <p className="text-muted-foreground mb-4">No projects yet.</p>
            <Link href="/dashboard/projects/new">
              <Button>Create Your First Project</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Configuration Instructions */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-xl font-semibold mb-4">VSCode Configuration</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add these to your VSCode settings (Ctrl+, → search "devsync"):
        </p>
        <div className="space-y-2 font-mono text-sm bg-muted p-4 rounded">
          <div>
            <span className="text-muted-foreground">devsync.apiUrl:</span>{' '}
            <span className="text-primary">http://localhost:3000</span>
          </div>
          <div>
            <span className="text-muted-foreground">devsync.apiKey:</span>{' '}
            <span className="text-primary">[Copy token above]</span>
          </div>
          <div>
            <span className="text-muted-foreground">devsync.projectId:</span>{' '}
            <span className="text-primary">[Copy project ID above]</span>
          </div>
        </div>
      </div>
    </div>
  );
}

