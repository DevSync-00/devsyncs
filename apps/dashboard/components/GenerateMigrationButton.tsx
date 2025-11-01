'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileCode, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GenerateMigrationButtonProps {
  scanReportId: string;
}

export default function GenerateMigrationButton({ scanReportId }: GenerateMigrationButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/migrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanReportId,
          format: 'sql',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate migration');
      }

      const migration = await response.json();
      
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
      alert(error instanceof Error ? error.message : 'Failed to generate migration');
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

