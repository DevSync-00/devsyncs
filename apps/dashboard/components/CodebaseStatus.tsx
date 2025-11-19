'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, GitBranch, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodebaseStatusProps {
  projectId: string;
}

interface CodebaseStatusData {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_configured' | 'unknown';
  type?: 'git' | 'upload';
  url?: string;
  uploadedFiles?: string[];
  fileCount?: number;
  error?: string | null;
  jobId?: string | null;
  clonedAt?: string | null;
}

export default function CodebaseStatus({ projectId }: CodebaseStatusProps) {
  const [status, setStatus] = useState<CodebaseStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/codebase-status`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch status');
        }

        if (mounted) {
          setStatus(data);
          setError(null);
          setLoading(false);

          // Set up polling if still processing
          if (data.status === 'pending' || data.status === 'processing') {
            if (!interval) {
              interval = setInterval(fetchStatus, 2000);
            }
          } else if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchStatus();

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm border border-destructive/20">
        {error}
      </div>
    );
  }

  if (!status || status.status === 'not_configured') {
    return null;
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'completed':
        return status.type === 'git' ? 'Repository cloned successfully' : 'Files uploaded successfully';
      case 'failed':
        return 'Processing failed';
      case 'processing':
        return status.type === 'git' ? 'Cloning repository...' : 'Uploading files...';
      case 'pending':
        return 'Waiting to process...';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'failed':
        return 'bg-destructive/10 border-destructive/20 text-destructive';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  return (
    <div className={cn('border rounded-lg p-4 space-y-3', getStatusColor())}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status.type === 'git' ? (
            <GitBranch className="w-4 h-4" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span className="font-medium text-sm">
            {status.type === 'git' ? 'Git Repository' : 'File Upload'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      {status.type === 'git' && status.url && (
        <div className="text-xs">
          <span className="font-medium">URL:</span>{' '}
          <code className="bg-background/50 px-1.5 py-0.5 rounded text-xs">
            {status.url}
          </code>
        </div>
      )}

      {status.type === 'upload' && status.fileCount !== undefined && (
        <div className="text-xs">
          <span className="font-medium">Files:</span> {status.fileCount} file(s) uploaded
        </div>
      )}

      {status.status === 'completed' && status.clonedAt && (
        <div className="text-xs text-muted-foreground">
          Completed at {new Date(status.clonedAt).toLocaleString()}
        </div>
      )}

      {status.status === 'failed' && status.error && (
        <div className="text-xs">
          <span className="font-medium">Error:</span> {status.error}
        </div>
      )}

      {status.status === 'processing' && (
        <div className="text-xs text-muted-foreground">
          This may take a few moments...
        </div>
      )}
    </div>
  );
}

