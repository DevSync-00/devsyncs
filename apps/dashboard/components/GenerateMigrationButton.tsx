'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileCode, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { robustFetchJSON, getErrorMessage } from '@/lib/fetch';

interface GenerateMigrationButtonProps {
  scanReportId: string;
}

export default function GenerateMigrationButton({ scanReportId }: GenerateMigrationButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    
    try {
      const migration = await robustFetchJSON<{ filename?: string; id: string }>('/api/migrations', {
        method: 'POST',
        body: JSON.stringify({
          scanReportId,
          format: 'sql',
        }),
        timeout: 60000, // 60 seconds for migration generation
      });
      toast({
        title: 'Migration generated',
        description: migration.filename ? `${migration.filename} is ready.` : 'Migration available in history.',
      });
      // Refresh the page to show the new migration
      router.refresh();
      
      // Scroll to migrations section
      setTimeout(() => {
        const migrationsSection = document.getElementById('migrations-section');
        if (migrationsSection) {
          migrationsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('Error generating migration:', error);
      toast({
        title: 'Unable to generate migration',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading}
      className="flex items-center gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileCode className="w-4 h-4" />
          Generate Migration
        </>
      )}
    </Button>
  );
}

