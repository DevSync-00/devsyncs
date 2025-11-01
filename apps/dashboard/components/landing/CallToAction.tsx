"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Github, MessageSquare } from "lucide-react";
import { useState } from "react";

const CallToAction = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to signup with email
    window.location.href = `/auth/signup?email=${encodeURIComponent(email)}`;
  };

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-hero opacity-50" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />

      <div className="container mx-auto max-w-4xl relative z-10">
        <div className="text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-bold leading-tight">
            Your Stack. Always in{" "}
            <span className="text-gradient">Sync</span>.
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join early access and experience the future of AI-powered development.
          </p>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto pt-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-card/50 border-primary/30 focus:border-primary h-12"
              required
            />
            <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-primary group">
              Get Access Now
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </form>

          {/* Community links */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card/50 hover:border-primary/50 transition-colors"
            >
              <Github className="w-5 h-5" />
              <span className="font-medium">GitHub</span>
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card/50 hover:border-primary/50 transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">Discord</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;

