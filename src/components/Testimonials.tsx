import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "DevSync caught a missing table that would have broken production. The AI explanation helped our team understand the issue immediately. Game changer for our Prisma + PostgreSQL stack.",
    author: "Sarah Chen",
    role: "Lead Engineer @ TechCorp",
  },
  {
    quote: "The GitHub Actions integration is brilliant. Every PR automatically gets schema mismatch reports. We've eliminated 100% of schema-related production incidents since using DevSync.",
    author: "Marcus Rodriguez",
    role: "CTO @ StartupXYZ",
  },
  {
    quote: "Supporting 9 schema types means it works with our entire stack—Prisma, TypeORM, and Supabase. The migration generation with rollback scripts saved us from a disaster last week.",
    author: "Aisha Patel",
    role: "Senior Developer @ CloudScale",
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Trusted by <span className="text-gradient">Engineering Teams</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            See what developers are saying about DevSync.ai
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative p-8 rounded-2xl border border-primary/30 bg-card/50 backdrop-blur-sm hover:border-primary/60 transition-all duration-300 hover:glow-primary"
            >
              <Quote className="w-10 h-10 text-primary/30 mb-4" />
              <blockquote className="text-foreground leading-relaxed mb-6">
                "{testimonial.quote}"
              </blockquote>
              <div className="space-y-1">
                <div className="font-semibold text-foreground">{testimonial.author}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent opacity-50" />
      <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-accent/20 to-transparent opacity-50" />
    </section>
  );
};

export default Testimonials;
