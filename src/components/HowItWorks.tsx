import { Search, Stethoscope, RefreshCw } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Detect",
    description: "DevSync.ai scans your IDE and database connections in real-time, identifying potential mismatches.",
  },
  {
    icon: Stethoscope,
    title: "Diagnose",
    description: "Finds mismatches, outdated migrations, or missing fields before they cause production issues.",
  },
  {
    icon: RefreshCw,
    title: "Sync",
    description: "Auto-generates fix suggestions or executes safe sync operations to keep everything aligned.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Three simple steps to perfect sync
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative group"
            >
              <div className="relative p-8 rounded-2xl border border-primary/30 bg-card/50 backdrop-blur-sm hover:border-primary/60 transition-all duration-300 hover:glow-primary h-full">
                {/* Step number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground text-xl shadow-lg">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className="mb-6 mt-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="w-8 h-8 text-primary animate-pulse-slow" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>

                {/* Animated arrow for non-last items */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-20">
                    <div className="text-primary animate-pulse">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
    </section>
  );
};

export default HowItWorks;
