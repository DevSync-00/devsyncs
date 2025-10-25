import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "DevSync.ai saved us hours of debugging after every migration. It's like having a safety net for our entire database.",
    author: "Sarah Chen",
    role: "Lead Engineer @ TechCorp",
  },
  {
    quote: "It's like having an AI DevOps teammate who never sleeps. The peace of mind is invaluable.",
    author: "Marcus Rodriguez",
    role: "CTO @ StartupXYZ",
  },
  {
    quote: "We caught three critical schema mismatches before they hit production. This tool pays for itself instantly.",
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
