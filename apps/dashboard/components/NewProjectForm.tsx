'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { GitBranch, Upload, Loader2 } from 'lucide-react';
import { formatErrorMessage } from '@/lib/error-utils';
import { useToast } from '@/hooks/use-toast';
import { fetchJSON } from '@/lib/fetch-utils';
import GitHubAppConnection from '@/components/github/GitHubAppConnection';
import GitHubRepositoryPicker from '@/components/github/GitHubRepositoryPicker';

interface NewProjectFormProps {
  userId: string;
  teamId?: string;
}

// Validation schema
const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must be less than 100 characters'),
  schemaType: z.enum([
    'prisma',
    'supabase',
    'typeorm',
    'kysely',
    'sequelize',
    'drizzle',
    'django',
    'sqlalchemy',
    'raw-sql'
  ], {
    required_error: 'Schema type is required',
  }),
  dbConnectionString: z.string().min(1, 'Database connection string is required').refine(
    (val) => {
      // Basic URI validation
      try {
        const url = new URL(val);
        return ['postgresql:', 'postgres:', 'mysql:', 'mongodb:'].some(prefix => val.startsWith(prefix));
      } catch {
        return false;
      }
    },
    { message: 'Invalid database connection string format' }
  ),
  codebaseSource: z.enum(['git', 'upload'], {
    required_error: 'Codebase source is required',
  }),
  gitUrl: z.string().optional(),
  uploadedFiles: z.instanceof(FileList).optional(),
}).refine(
  (data) => {
    if (data.codebaseSource === 'git') {
      return data.gitUrl && data.gitUrl.length > 0;
    }
    return true;
  },
  {
    message: 'Git URL is required when using Git repository',
    path: ['gitUrl'],
  }
).refine(
  (data) => {
    if (data.codebaseSource === 'upload') {
      return data.uploadedFiles && data.uploadedFiles.length > 0;
    }
    return true;
  },
  {
    message: 'Please select files to upload',
    path: ['uploadedFiles'],
  }
);

type ProjectFormData = z.infer<typeof projectSchema>;

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

export default function NewProjectForm({ userId, teamId }: NewProjectFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      codebaseSource: 'git',
    },
  });

  const codebaseSource = watch('codebaseSource');
  const gitUrl = watch('gitUrl') || '';

  const onSubmit = async (data: ProjectFormData) => {
    setLoading(true);
    setError(null);

    try {
      // Generate slug from name
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const codebase =
        data.codebaseSource === 'git'
          ? { type: 'git' as const, url: data.gitUrl }
          : {
              type: 'upload' as const,
              files: Array.from(data.uploadedFiles || []).map((file) => ({
                name: file.name,
                size: file.size,
                type: file.type,
              })),
            };

      const response = await fetchJSON<{ project: { id: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          slug,
          schemaType: data.schemaType,
          dbConnectionString: data.dbConnectionString,
          codebase,
          teamId: teamId || null,
        }),
        timeout: 30000,
        retries: 1,
      });

      const project = response.project;

      // Show success toast
      toast({
        title: 'Project created',
        description: `${data.name} has been created successfully.`,
      });

      // Redirect to project dashboard
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err: any) {
      console.error('Project creation error:', err);
      const formatted = formatErrorMessage(err, {
        operation: 'create',
        resource: 'project',
      });
      setError(formatted.message);
      setErrorDetails(formatted.actionable || null);
      setLoading(false);
      
      // Also show toast for error
      toast({
        title: formatted.title,
        description: formatted.actionable || formatted.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm space-y-1">
          <div className="font-medium">{error}</div>
          {errorDetails && (
            <div className="text-destructive/80 text-xs mt-1">{errorDetails}</div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* Project Name */}
        <div>
          <Label htmlFor="name">
            Project Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="My Awesome Project"
            className="mt-2"
            disabled={loading}
          />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Schema Type */}
        <div>
          <Label htmlFor="schemaType">
            Schema Type <span className="text-destructive">*</span>
          </Label>
          <Select
            id="schemaType"
            {...register('schemaType')}
            className="mt-2"
            disabled={loading}
          >
            <option value="">Select a schema type...</option>
            {SCHEMA_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          {errors.schemaType && (
            <p className="text-sm text-destructive mt-1">{errors.schemaType.message}</p>
          )}
        </div>

        {/* Database Connection String */}
        <div>
          <Label htmlFor="dbConnectionString">
            Database Connection String <span className="text-destructive">*</span>
          </Label>
          <Input
            id="dbConnectionString"
            type="password"
            {...register('dbConnectionString')}
            placeholder="postgresql://user:password@localhost:5432/dbname"
            className="mt-2"
            disabled={loading}
          />
          {errors.dbConnectionString && (
            <p className="text-sm text-destructive mt-1">{errors.dbConnectionString.message}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Your connection string is sent only to the server. Use a least-privilege database user.
          </p>
        </div>

        {/* Codebase Source */}
        <div>
          <Label>
            Codebase Source <span className="text-destructive">*</span>
          </Label>
          <div className="mt-2 space-y-3">
            <div className="flex items-center space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors">
              <input
                type="radio"
                {...register('codebaseSource')}
                value="git"
                id="source-git"
                disabled={loading}
                className="h-4 w-4"
              />
              <label htmlFor="source-git" className="flex-1 cursor-pointer">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-medium">Git Repository</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect to a Git repository (GitHub, GitLab, etc.)
                </p>
              </label>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors">
              <input
                type="radio"
                {...register('codebaseSource')}
                value="upload"
                id="source-upload"
                disabled={loading}
                className="h-4 w-4"
              />
              <label htmlFor="source-upload" className="flex-1 cursor-pointer">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Upload Folder</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload your project files directly
                </p>
              </label>
            </div>
          </div>
          {errors.codebaseSource && (
            <p className="text-sm text-destructive mt-1">{errors.codebaseSource.message}</p>
          )}
        </div>

        {/* Conditional: Git URL */}
        {codebaseSource === 'git' && (
          <div className="space-y-4">
            <GitHubAppConnection />
            <div>
            <Label htmlFor="gitUrl">
              Git Repository URL <span className="text-destructive">*</span>
            </Label>
            <input type="hidden" {...register('gitUrl')} />
            <div className="mt-2">
              <GitHubRepositoryPicker
                value={gitUrl}
                onChange={(url) => setValue('gitUrl', url, {
                  shouldDirty: true,
                  shouldValidate: true,
                })}
                disabled={loading}
              />
            </div>
            {errors.gitUrl && (
              <p className="text-sm text-destructive mt-1">{errors.gitUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Supports GitHub HTTPS URLs. Select private repositories when installing the DevSync GitHub App.
            </p>
            </div>
          </div>
        )}

        {/* Conditional: File Upload */}
        {codebaseSource === 'upload' && (
          <div>
            <Label htmlFor="uploadedFiles">
              Upload Project Files <span className="text-destructive">*</span>
            </Label>
            <Input
              id="uploadedFiles"
              type="file"
              multiple
              {...register('uploadedFiles')}
              className="mt-2"
              disabled={loading}
            />
            {errors.uploadedFiles && (
              <p className="text-sm text-destructive mt-1">{errors.uploadedFiles.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Select multiple files or folders from your project directory.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Project'
          )}
        </Button>
      </div>
    </form>
  );
}
