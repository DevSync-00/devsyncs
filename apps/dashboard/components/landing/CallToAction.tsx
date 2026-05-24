"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, BookOpen } from "lucide-react";
import { useState } from "react";

const CallToAction = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `/auth/signup?email=${encodeURIComponent(email)}`;
  };

  return (
    <section className="py-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 mesh-grid opacity-40 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/15 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" />

      <div className="container mx-auto max-w-3xl relative z-10">
        <div className="text-center p-10 md:p-14 rounded-3xl border border-white/10 glass-strong shadow-elevated">
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-4">
            Ready to sync with{" "}
            <span className="text-gradient">confidence</span>?
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
            Create a free account, connect your first project, and run your first
            read-only scan in minutes.
          </p>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6"
          >
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-12 bg-background/80 border-border focus:border-primary"
              required
              aria-label="Email address"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 gradient-primary text-primary-foreground border-0 hover:opacity-90 glow-primary group shrink-0"
            >
              Get started
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </form>

          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Or explore the documentation first
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
