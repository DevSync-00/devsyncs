interface CodeBlockProps {
  children: string;
  language?: string;
}

export default function CodeBlock({ children, language }: CodeBlockProps) {
  return (
    <div className="relative my-6">
      <div className="absolute top-0 right-0 px-3 py-1 text-xs text-muted-foreground bg-card border-b border-l border-border rounded-bl">
        {language || 'code'}
      </div>
      <pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <code className="text-sm font-mono text-foreground whitespace-pre">
          {children}
        </code>
      </pre>
    </div>
  );
}

