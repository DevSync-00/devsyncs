import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import DeveloperExperience from "@/components/DeveloperExperience";
import Integrations from "@/components/Integrations";
import Testimonials from "@/components/Testimonials";
import CallToAction from "@/components/CallToAction";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <HowItWorks />
      <Features />
      <DeveloperExperience />
      <Integrations />
      <Testimonials />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default Index;
