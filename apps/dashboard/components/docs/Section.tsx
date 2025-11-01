import { ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
}

export default function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight mt-8 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

