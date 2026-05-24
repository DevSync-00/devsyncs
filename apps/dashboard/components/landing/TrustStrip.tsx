import { CheckCircle2, Lock, Scan, Layers } from "lucide-react";

const items = [
  { icon: Scan, label: "Read-only scan by default" },
  { icon: Lock, label: "Preview before any apply" },
  { icon: Layers, label: "Prisma, Supabase, TypeORM & more" },
  { icon: CheckCircle2, label: "CLI + VS Code + Dashboard" },
];

export default function TrustStrip() {
  return (
    <section className="relative border-y border-border/60 bg-secondary/20">
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2.5 text-sm text-muted-foreground"
            >
              <item.icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
