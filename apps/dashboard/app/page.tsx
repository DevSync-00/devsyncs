import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import TrustStrip from "@/components/landing/TrustStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Safety from "@/components/landing/Safety";
import DeveloperExperience from "@/components/landing/DeveloperExperience";
import CallToAction from "@/components/landing/CallToAction";
import Footer from "@/components/landing/Footer";
import ElasticGridBackground from '@/components/animations/ElasticGridBackground';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <ElasticGridBackground />
      <div className="relative z-10">
        <LandingNav />
        <main>
          <Hero />
          <TrustStrip />
          <HowItWorks />
          <Features />
          <Safety />
          <DeveloperExperience />
          <CallToAction />
        </main>
        <Footer />
      </div>
    </div>
  );
}
