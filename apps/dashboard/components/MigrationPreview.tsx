'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Copy, CheckCircle, AlertTriangle, FileCode, History } from 'lucide-react';
import ApplyMigrationButton from './ApplyMigrationButton';
import RollbackMigrationButton from './RollbackMigrationButton';
import MigrationHistory from './MigrationHistory';

interface MigrationPreviewProps {
  migration: {
    id: string;
    filename: string;
    content: string;
    format: string;
    applied: boolean;
    execution_status?: string;
    created_at: string;
  };
  onApply?: () => void;
}

export default function MigrationPreview({ migration, onApply }: MigrationPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(migration.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([migration.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = migration.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold">{migration.filename}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(migration.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ApplyMigrationButton
            migrationId={migration.id}
            applied={migration.applied}
            executionStatus={migration.execution_status}
            onSuccess={onApply}
          />
          <RollbackMigrationButton
            migrationId={migration.id}
            applied={migration.applied}
            executionStatus={migration.execution_status}
            onSuccess={onApply}
          />
        </div>
      </div>

      <div className="relative">
        <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
          <code>{migration.content}</code>
        </pre>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : 'Copy SQL'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          {showHistory ? 'Hide' : 'Show'} History
        </Button>
      </div>

      {showHistory && (
        <div className="mt-4 pt-4 border-t border-border">
          <MigrationHistory migrationId={migration.id} />
        </div>
      )}
    </div>
  );
}

