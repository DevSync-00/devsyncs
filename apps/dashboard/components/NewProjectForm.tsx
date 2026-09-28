'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, ArrowRight, Check, Database, Github, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatErrorMessage } from '@/lib/error-utils';
import { useToast } from '@/hooks/use-toast';
import { fetchJSON } from '@/lib/fetch-utils';
import GitHubRepositoryPicker from '@/components/github/GitHubRepositoryPicker';

interface NewProjectFormProps { userId: string; teamId?: string }

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  schemaType: z.enum(['prisma', 'supabase', 'typeorm', 'kysely', 'sequelize', 'drizzle', 'django', 'sqlalchemy', 'raw-sql']),
  dbConnectionString: z.string().min(1, 'Database connection string is required').refine(
    (value) => /^postgres(ql)?:\/\//i.test(value),
    'Use a PostgreSQL connection string beginning with postgres:// or postgresql://',
  ),
  gitUrl: z.string().url('Select an authorized repository or enter a valid public GitHub URL'),
});

type ProjectFormData = z.infer<typeof projectSchema>;
type Verification = { database: string; role: string; message: string };

const SCHEMA_TYPES = [
  ['prisma', 'Prisma'], ['supabase', 'Supabase'], ['drizzle', 'Drizzle ORM'],
  ['typeorm', 'TypeORM'], ['kysely', 'Kysely'], ['sequelize', 'Sequelize'],
  ['django', 'Django'], ['sqlalchemy', 'SQLAlchemy'], ['raw-sql', 'Raw SQL'],
] as const;

const STEPS = [
  { title: 'Repository', description: 'Choose the code source', icon: Github },
  { title: 'Read-only database', description: 'Verify safe access', icon: Database },
  { title: 'Review', description: 'Confirm and scan', icon: ShieldCheck },
];

export default function NewProjectForm({ teamId }: NewProjectFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, trigger, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: { schemaType: 'prisma' },
  });
  const name = watch('name') || '';
  const schemaType = watch('schemaType');
  const gitUrl = watch('gitUrl') || '';
  const connectionString = watch('dbConnectionString') || '';

  useEffect(() => { setVerification(null); }, [connectionString]);

  const continueFromRepository = async () => {
    if (await trigger(['name', 'schemaType', 'gitUrl'])) setStep(1);
  };

  const verifyDatabase = async () => {
    if (!(await trigger('dbConnectionString'))) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await fetchJSON<Verification & { verified: boolean }>('/api/database/verify', {
        method: 'POST',
        body: JSON.stringify({ connectionString }),
        timeout: 15_000,
        retries: 0,
      });
      setVerification(result);
      toast({ title: 'Read-only access verified', description: `Connected as ${result.role} to ${result.database}.` });
    } catch (err) {
      setVerification(null);
      setError(err instanceof Error ? err.message : 'Database verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    if (!verification) {
      setStep(1);
      setError('Verify the database with a read-only role before continuing.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const response = await fetchJSON<{ project: { id: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          slug,
          schemaType: data.schemaType,
          dbConnectionString: data.dbConnectionString,
          codebase: { type: 'git', url: data.gitUrl },
          teamId: teamId || null,
        }),
        timeout: 120_000,
        retries: 0,
      });
      toast({ title: 'Project connected', description: 'Repository and read-only database are ready for the first scan.' });
      router.push(`/dashboard/projects/${response.project.id}?onboarding=scan`);
    } catch (err) {
      const formatted = formatErrorMessage(err, { operation: 'create', resource: 'project' });
      setError(formatted.actionable || formatted.message);
      toast({ title: formatted.title, description: formatted.actionable || formatted.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <ol className="grid gap-2 sm:grid-cols-3" aria-label="Project setup progress">
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          const complete = index < step;
          const active = index === step;
          return (
            <li key={item.title} className={`rounded-xl border p-3 ${active ? 'border-primary bg-primary/5' : 'bg-card'}`} aria-current={active ? 'step' : undefined}>
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <div><div className="text-xs font-semibold">{item.title}</div><div className="text-[10px] text-muted-foreground">{item.description}</div></div>
              </div>
            </li>
          );
        })}
      </ol>

      {error ? <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="rounded-2xl border bg-card p-5 sm:p-7">
        {step === 0 ? (
          <div className="space-y-5">
            <div><h2 className="text-lg font-semibold">Connect the repository</h2><p className="mt-1 text-sm text-muted-foreground">DevSync reads schema and application references from one authorized repository.</p></div>
            <div><Label htmlFor="name">Project name</Label><Input id="name" {...register('name')} placeholder="Payments API" className="mt-2" />{errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name.message}</p> : null}</div>
            <div><Label htmlFor="schemaType">Schema source</Label><Select id="schemaType" {...register('schemaType')} className="mt-2">{SCHEMA_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            <div><Label>GitHub repository</Label><input type="hidden" {...register('gitUrl')} /><div className="mt-2"><GitHubRepositoryPicker value={gitUrl} onChange={(url) => setValue('gitUrl', url, { shouldValidate: true, shouldDirty: true })} disabled={loading} /></div>{errors.gitUrl ? <p className="mt-1 text-xs text-destructive">{errors.gitUrl.message}</p> : null}</div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div><h2 className="text-lg font-semibold">Connect a read-only database</h2><p className="mt-1 text-sm text-muted-foreground">DevSync verifies the role can inspect schemas but cannot change tables or schema objects.</p></div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-muted-foreground"><div className="flex gap-2 font-medium text-foreground"><LockKeyhole className="h-4 w-4 text-blue-500" /> Required permissions</div><p className="mt-2">Grant only CONNECT on the database, USAGE on the schema, and SELECT on tables. Never use an owner, admin, or migration role.</p></div>
            <div><Label htmlFor="dbConnectionString">PostgreSQL connection string</Label><Input id="dbConnectionString" type="password" autoComplete="off" {...register('dbConnectionString')} placeholder="postgresql://devsync_reader:••••@host/database?sslmode=require" className="mt-2 font-mono" />{errors.dbConnectionString ? <p className="mt-1 text-xs text-destructive">{errors.dbConnectionString.message}</p> : null}</div>
            {verification ? <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><ShieldCheck className="h-4 w-4" /> Read-only access verified</div><p className="mt-1 text-xs text-muted-foreground">Database <strong>{verification.database}</strong> · role <strong>{verification.role}</strong></p></div> : null}
            <Button type="button" variant="outline" onClick={verifyDatabase} disabled={verifying || !connectionString}>{verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{verifying ? 'Verifying permissions…' : 'Verify read-only access'}</Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div><h2 className="text-lg font-semibold">Ready for the first scan</h2><p className="mt-1 text-sm text-muted-foreground">DevSync will compare the schema in code with the live database. Nothing will be written.</p></div>
            <dl className="divide-y rounded-xl border">
              <ReviewRow label="Project" value={name} />
              <ReviewRow label="Repository" value={gitUrl.replace('https://github.com/', '')} />
              <ReviewRow label="Schema source" value={SCHEMA_TYPES.find(([value]) => value === schemaType)?.[1] || schemaType} />
              <ReviewRow label="Database access" value={`${verification?.database} · ${verification?.role} · read-only verified`} />
            </dl>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4 text-emerald-500" /> Creating this project does not run SQL or modify the repository.</div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => step === 0 ? router.back() : setStep((value) => value - 1)} disabled={loading}><ArrowLeft className="mr-2 h-4 w-4" />{step === 0 ? 'Cancel' : 'Back'}</Button>
        {step === 0 ? <Button type="button" onClick={continueFromRepository}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : null}
        {step === 1 ? <Button type="button" onClick={() => setStep(2)} disabled={!verification}>Review setup <ArrowRight className="ml-2 h-4 w-4" /></Button> : null}
        {step === 2 ? <Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{loading ? 'Connecting project…' : 'Connect project'}</Button> : null}
      </div>
    </form>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-all text-sm font-medium">{value}</dd></div>;
}
