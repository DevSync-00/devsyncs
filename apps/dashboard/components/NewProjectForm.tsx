'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface NewProjectFormProps {
  userId: string;
  teamId?: string;
}

export default function NewProjectForm({ userId, teamId }: NewProjectFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const schemaType = formData.get('schemaType') as string;
    const dbConnection = formData.get('dbConnection') as string;

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({
        name,
        slug,
        user_id: userId,
        team_id: teamId || null,
        schema_type: schemaType,
        db_connection_string: dbConnection || null,
        config: {},
      })
      .select()
      .single();

    if (insertError) {
      // Enhanced error logging
      console.error('Project creation error:', {
        error: insertError,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        message: insertError.message,
        formData: { name, slug, schemaType, userId },
      });
      
      // Show detailed error message
      let errorMessage = insertError.message;
      if (insertError.code) {
        errorMessage += ` (Code: ${insertError.code})`;
      }
      if (insertError.hint) {
        errorMessage += ` - ${insertError.hint}`;
      }
      
      setError(errorMessage);
      setLoading(false);
    } else if (data) {
      router.push(`/dashboard/projects/${data.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Project Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full px-4 py-2 bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="My Project"
          />
        </div>

        <div>
          <label htmlFor="schemaType" className="block text-sm font-medium mb-2">
            Schema Type
          </label>
          <select
            id="schemaType"
            name="schemaType"
            required
            className="w-full px-4 py-2 bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="prisma">Prisma</option>
            <option value="supabase">Supabase</option>
            <option value="typeorm">TypeORM</option>
            <option value="kysely">Kysely</option>
            <option value="sequelize">Sequelize</option>
            <option value="drizzle">Drizzle ORM</option>
            <option value="django">Django</option>
            <option value="sqlalchemy">SQLAlchemy</option>
            <option value="raw-sql">Raw SQL</option>
          </select>
        </div>

        <div>
          <label htmlFor="dbConnection" className="block text-sm font-medium mb-2">
            Database Connection String (Optional)
          </label>
          <input
            id="dbConnection"
            name="dbConnection"
            type="password"
            className="w-full px-4 py-2 bg-card border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="postgresql://user:pass@localhost:5432/db"
          />
          <p className="text-xs text-muted-foreground mt-2">
            You can add this later. It's stored securely and encrypted.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}

