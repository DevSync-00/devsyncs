'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchJSON } from '@/lib/fetch-utils';
import { useToast } from '@/hooks/use-toast';

interface RunScanButtonProps {
  projectId: string;
}

export default function RunScanButton({ projectId }: RunScanButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const runScan = async () => {
    setLoading(true);

    try {
      const result = await fetchJSON<{ scanId: string }>('/api/scans', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
        }),
        timeout: 300000,
        retries: 0,
      });

      toast({
        title: 'Scan completed',
        description: 'Repository and database schemas were compared.',
      });

      router.refresh();
      router.push(`/dashboard/projects/${projectId}/scan-reports/${result.scanId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run scan';
      console.error('Scan failed:', error);
      toast({
        title: 'Scan failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="lg" onClick={runScan} disabled={loading}>
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Scan className="w-4 h-4 mr-2" />
      )}
      {loading ? 'Running...' : 'Run Scan'}
    </Button>
  );
}
