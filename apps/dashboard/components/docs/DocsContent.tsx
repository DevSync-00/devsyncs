import { ReactNode } from 'react';

interface DocsContentProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function DocsContent({ title, description, children }: DocsContentProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4 pb-8 border-b border-border">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-xl text-muted-foreground">{description}</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none">
          <div className="space-y-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

