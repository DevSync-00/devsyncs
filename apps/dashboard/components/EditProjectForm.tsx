'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const SCHEMA_TYPES = [
  { value: 'prisma', label: 'Prisma' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'typeorm', label: 'TypeORM' },
  { value: 'kysely', label: 'Kysely' },
  { value: 'sequelize', label: 'Sequelize' },
  { value: 'drizzle', label: 'Drizzle ORM' },
  { value: 'django', label: 'Django' },
  { value: 'sqlalchemy', label: 'SQLAlchemy' },
  { value: 'raw-sql', label: 'Raw SQL' },
];

interface EditProjectFormProps {
  project: {
    id: string;
    name: string;
    schema_type: string;
    dbConnectionPreview?: string | null;
  };
}

export default function EditProjectForm({ project }: EditProjectFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(project.name);
  const [schemaType, setSchemaType] = useState(project.schema_type);
  const [dbConnectionString, setDbConnectionString] = useState('');
  const [clearConnection, setClearConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        schemaType,
      };

      if (clearConnection) {
        payload.dbConnectionString = '';
      } else if (dbConnectionString.trim()) {
        payload.dbConnectionString = dbConnectionString.trim();
      }

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to update project');
      }

      toast({
        title: 'Project updated',
        description: `${payload.name} was saved.`,
      });
      router.push(`/dashboard/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project';
      setError(message);
      toast({
        title: 'Update failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={saveProject} className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schemaType">Schema type</Label>
        <Select
          id="schemaType"
          value={schemaType}
          onChange={(event) => setSchemaType(event.target.value)}
          disabled={saving}
        >
          {SCHEMA_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dbConnectionString">Database connection string</Label>
        <Input
          id="dbConnectionString"
          value={dbConnectionString}
          onChange={(event) => setDbConnectionString(event.target.value)}
          placeholder={project.dbConnectionPreview || 'Leave blank to keep the current connection'}
          disabled={saving || clearConnection}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to keep the current value. Paste a full Postgres URL to replace it.
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={clearConnection}
            onChange={(event) => setClearConnection(event.target.checked)}
            disabled={saving}
          />
          Clear database connection
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save changes
        </Button>
        <Link href={`/dashboard/projects/${project.id}`}>
          <Button type="button" variant="outline" disabled={saving}>
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
