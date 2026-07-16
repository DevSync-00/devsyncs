'use client';

import { useEffect, useState } from 'react';

export default function SchemaMeshBg() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <svg
        className="w-full h-full opacity-30 dark:opacity-40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes driftNode1 {
            0%, 100% { transform: translate(0px, 0px); }
            33% { transform: translate(15px, -10px); }
            66% { transform: translate(-10px, 15px); }
          }
          @keyframes driftNode2 {
            0%, 100% { transform: translate(0px, 0px); }
            50% { transform: translate(-20px, -20px); }
          }
          @keyframes driftNode3 {
            0%, 100% { transform: translate(0px, 0px); }
            40% { transform: translate(15px, 20px); }
            80% { transform: translate(-15px, -10px); }
          }
          @keyframes schemaPulse {
            0%, 100% { stroke-dashoffset: 100; stroke-width: 1px; opacity: 0.15; }
            50% { stroke-dashoffset: 0; stroke-width: 1.5px; opacity: 0.35; }
          }
          @keyframes textFade {
            0%, 100% { opacity: 0.05; }
            50% { opacity: 0.25; }
          }
          .node-group-1 { animation: driftNode1 20s ease-in-out infinite; }
          .node-group-2 { animation: driftNode2 25s ease-in-out infinite; }
          .node-group-3 { animation: driftNode3 18s ease-in-out infinite; }
          .relation-line {
            stroke: hsl(var(--primary));
            stroke-dasharray: 8 16;
            animation: schemaPulse 12s linear infinite;
          }
          .relation-line-alt {
            stroke: hsl(var(--accent));
            stroke-dasharray: 4 8;
            animation: schemaPulse 8s linear infinite;
          }
          .mesh-text {
            font-family: var(--font-jetbrains), monospace;
            font-size: 10px;
            fill: hsl(var(--foreground));
            animation: textFade 6s ease-in-out infinite;
          }
        `}} />

        {/* Definitions for Glow Filters */}
        <defs>
          <filter id="glow-node" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Mesh connection paths */}
        <g className="opacity-40">
          {/* Relational paths between moving groups */}
          <line x1="15%" y1="25%" x2="45%" y2="20%" className="relation-line" />
          <line x1="45%" y1="20%" x2="35%" y2="60%" className="relation-line-alt" />
          <line x1="35%" y1="60%" x2="15%" y2="25%" className="relation-line" />
          
          <line x1="45%" y1="20%" x2="75%" y2="35%" className="relation-line" />
          <line x1="75%" y1="35%" x2="65%" y2="75%" className="relation-line-alt" />
          <line x1="65%" y1="75%" x2="35%" y2="60%" className="relation-line" />

          <line x1="75%" y1="35%" x2="90%" y2="15%" className="relation-line" />
          <line x1="35%" y1="60%" x2="10%" y2="80%" className="relation-line-alt" />
        </g>

        {/* Floating Table Schema Nodes Group 1 */}
        <g className="node-group-1">
          {/* Users Table Node */}
          <circle cx="15%" cy="25%" r="18" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" filter="url(#glow-node)" />
          <circle cx="15%" cy="25%" r="4" fill="hsl(var(--primary))" />
          <text x="15%" y="25%" dx="22" dy="4" className="mesh-text">users</text>
          
          {/* Audit Log Table Node */}
          <circle cx="90%" cy="15%" r="14" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.2)" strokeWidth="1" />
          <circle cx="90%" cy="15%" r="3" fill="hsl(var(--muted-foreground) / 0.5)" />
          <text x="90%" y="15%" dx="-80" dy="4" className="mesh-text">audit_logs</text>
        </g>

        {/* Floating Table Schema Nodes Group 2 */}
        <g className="node-group-2">
          {/* Projects Table Node */}
          <circle cx="45%" cy="20%" r="22" fill="hsl(var(--card))" stroke="hsl(var(--accent) / 0.4)" strokeWidth="1" filter="url(#glow-node)" />
          <circle cx="45%" cy="20%" r="6" fill="hsl(var(--accent))" className="animate-pulse" />
          <text x="45%" y="20%" dx="26" dy="4" className="mesh-text">projects</text>
          <text x="45%" y="20%" dx="26" dy="18" className="mesh-text" style={{ animationDelay: '2s' }}>ALTER TABLE</text>

          {/* Teams Table Node */}
          <circle cx="65%" cy="75%" r="20" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" filter="url(#glow-node)" />
          <circle cx="65%" cy="75%" r="5" fill="hsl(var(--primary))" />
          <text x="65%" y="75%" dx="24" dy="4" className="mesh-text">teams</text>
        </g>

        {/* Floating Table Schema Nodes Group 3 */}
        <g className="node-group-3">
          {/* Scan Reports Table Node */}
          <circle cx="35%" cy="60%" r="24" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1.5" filter="url(#glow-node)" />
          <circle cx="35%" cy="60%" r="7" fill="hsl(var(--primary))" />
          <text x="35%" y="60%" dx="28" dy="4" className="mesh-text">scan_reports</text>
          <text x="35%" y="60%" dx="28" dy="18" className="mesh-text" style={{ animationDelay: '1s', fill: 'hsl(var(--destructive))' }}>drift_detected</text>

          {/* Migrations Table Node */}
          <circle cx="75%" cy="35%" r="22" fill="hsl(var(--card))" stroke="hsl(var(--accent) / 0.3)" strokeWidth="1" filter="url(#glow-node)" />
          <circle cx="75%" cy="35%" r="6" fill="hsl(var(--accent))" />
          <text x="75%" y="35%" dx="26" dy="4" className="mesh-text">migrations</text>
          
          {/* API Keys Table Node */}
          <circle cx="10%" cy="80%" r="15" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.2)" strokeWidth="1" />
          <circle cx="10%" cy="80%" r="3.5" fill="hsl(var(--primary) / 0.6)" />
          <text x="10%" y="80%" dx="20" dy="4" className="mesh-text">api_keys</text>
        </g>

        {/* Background binary/code bits */}
        <text x="30%" y="40%" className="mesh-text opacity-10">schema_hash: "8fa2b1"</text>
        <text x="60%" y="15%" className="mesh-text opacity-10">PRAGMA foreign_keys = ON;</text>
        <text x="80%" y="65%" className="mesh-text opacity-10">COMMIT;</text>
        <text x="8%" y="55%" className="mesh-text opacity-10">CREATE UNIQUE INDEX</text>
      </svg>
    </div>
  );
}
