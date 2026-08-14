'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ProjectSelectorProps {
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string;
  compact?: boolean;
}

export function ProjectSelector({ projects, selectedProjectId, compact = false }: ProjectSelectorProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {!compact ? <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Project</span> : null}
      <select
        value={selectedProjectId}
        onChange={(e) => {
          const val = e.target.value;
          if (val) {
            router.push(`/dashboard/visualizer?projectId=${val}`);
          } else {
            router.push('/dashboard/visualizer');
          }
        }}
        aria-label="Select project to visualize"
        className={`${compact ? 'h-8 min-w-36 max-w-48 bg-background px-2 text-[10px]' : 'h-9 min-w-52 bg-card px-3 text-xs shadow-sm'} cursor-pointer rounded-md border font-mono font-medium text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/10`}
      >
        <option value="">Select a project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
