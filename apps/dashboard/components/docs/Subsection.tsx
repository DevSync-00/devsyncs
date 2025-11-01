import { ReactNode } from 'react';

interface SubsectionProps {
  title: string;
  children: ReactNode;
}

export default function Subsection({ title, children }: SubsectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xl font-medium tracking-tight mt-6 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

