import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import EditProjectForm from '@/components/EditProjectForm';
import { maskConnectionString } from '@/app/api/projects/utils';

export default async function EditProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !project) {
    notFound();
  }

  if (project.user_id !== user.id) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Edit Project</h1>
        <p className="text-muted-foreground mt-2">
          Update project details and database connection settings.
        </p>
      </div>
      <EditProjectForm
        project={{
          id: project.id,
          name: project.name,
          schema_type: project.schema_type,
          dbConnectionPreview: maskConnectionString(project.db_connection_string),
        }}
      />
    </div>
  );
}
