'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ProjectSelectorProps {
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string;
}

export function ProjectSelector({ projects, selectedProjectId }: ProjectSelectorProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium">Select Project:</span>
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
        className="px-3 py-1.5 text-xs rounded-xl border border-border/60 bg-card text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
      >
        <option value="">-- Select a project --</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}
