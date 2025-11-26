import { DeviceAuthCard } from '@/components/device/DeviceAuthCard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface DevicePageProps {
  searchParams?: {
    code?: string;
  };
}

export default async function DevicePage({ searchParams }: DevicePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextPath = searchParams?.code
      ? `/device?code=${encodeURIComponent(searchParams.code)}`
      : '/device';
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/30 to-muted flex items-center justify-center p-6">
      <DeviceAuthCard initialCode={searchParams?.code} />
    </div>
  );
}

