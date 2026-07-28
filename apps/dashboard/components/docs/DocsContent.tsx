import { ReactNode } from 'react';

interface DocsContentProps {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}

export default function DocsContent({ title, description, badge = "Documentation", children }: DocsContentProps) {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3 pb-8 border-b border-border/60">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
          {badge}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">{title}</h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">{description}</p>
      </div>

      {/* Article Content */}
      <div className="space-y-10 text-foreground">
        {children}
      </div>
    </div>
  );
}
