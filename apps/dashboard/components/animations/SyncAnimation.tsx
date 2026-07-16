'use client';

import { useState, useEffect } from 'react';
import { Play, RotateCcw, AlertTriangle, CheckCircle, Database, FileCode, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type SyncStage = 'idle' | 'scanning' | 'drift_detected' | 'syncing' | 'synced';

export default function SyncAnimation() {
  const [stage, setStage] = useState<SyncStage>('idle');
  const [dots, setDots] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    if (stage === 'syncing') {
      const interval = setInterval(() => {
        setDots((prev) => [
          ...prev.slice(-15),
          {
            x: 120 + Math.random() * 20,
            y: 75 + Math.random() * 10,
            id: Math.random(),
          },
        ]);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setDots([]);
    }
  }, [stage]);

  const handleStart = () => {
    setStage('scanning');
    setTimeout(() => {
      setStage('drift_detected');
    }, 2000);
  };

  const handleSync = () => {
    setStage('syncing');
    setTimeout(() => {
      setStage('synced');
    }, 3000);
  };

  const handleReset = () => {
    setStage('idle');
  };

  return (
    <Card className="glass-strong border border-border/60 overflow-hidden shadow-elevated relative p-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
        <div>
          <h3 className="font-semibold text-lg">Interactive Sync Simulator</h3>
          <p className="text-xs text-muted-foreground">
            Watch how DevSync detects and bridges schema drift automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stage === 'idle' && (
            <Button size="sm" onClick={handleStart} className="gradient-primary text-primary-foreground border-0">
              <Play className="w-4 h-4 mr-2" />
              Simulate Scan
            </Button>
          )}
          {stage === 'scanning' && (
            <Button size="sm" disabled className="bg-primary/20 text-primary border-0">
              <span className="w-4 h-4 mr-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Scanning...
            </Button>
          )}
          {stage === 'drift_detected' && (
            <Button size="sm" onClick={handleSync} className="bg-yellow-500 text-black hover:bg-yellow-400 border-0">
              <ArrowRight className="w-4 h-4 mr-2" />
              Apply Fixes (Safe Preview)
            </Button>
          )}
          {stage === 'syncing' && (
            <Button size="sm" disabled className="bg-accent/20 text-accent border-0">
              <span className="w-4 h-4 mr-2 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              Syncing Schema...
            </Button>
          )}
          {stage === 'synced' && (
            <Button size="sm" variant="outline" onClick={handleReset} className="border-border">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Demo
            </Button>
          )}
        </div>
      </div>

      {/* Simulator Display Screen */}
      <div className="h-44 w-full bg-background/50 border border-border/40 rounded-xl relative overflow-hidden flex items-center justify-center">
        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

        {/* Laser Scanner Line */}
        {stage === 'scanning' && (
          <div className="absolute inset-x-0 h-0.5 bg-primary/70 shadow-[0_0_15px_rgba(56,189,248,0.8)] z-10 animate-scan-line" />
        )}

        <div className="w-full max-w-md flex items-center justify-between px-10 relative">
          
          {/* Codebase Side */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              stage === 'scanning' ? 'bg-primary/20 border-primary scale-105' : 'bg-card border-border'
            } border-2 shadow-card`}>
              <FileCode className={`w-7 h-7 ${stage === 'scanning' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">schema.prisma</span>
          </div>

          {/* Connection Channel */}
          <div className="flex-1 h-0.5 bg-border/40 mx-4 relative">
            {stage === 'scanning' && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent w-full h-full animate-shimmer" />
            )}
            
            {/* Flowing sync dots */}
            {stage === 'syncing' && dots.map((dot) => (
              <div
                key={dot.id}
                className="absolute w-2 h-2 rounded-full bg-accent animate-pulse"
                style={{
                  left: `${((dot.x - 120) / 20) * 100}%`,
                  top: `${dot.y - 80}px`,
                  boxShadow: '0 0 8px hsl(var(--accent))',
                  transition: 'left 1s linear',
                }}
              />
            ))}
          </div>

          {/* Database Side */}
          <div className="flex flex-col items-center gap-2 z-10">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              stage === 'drift_detected' 
                ? 'bg-yellow-500/10 border-yellow-500 scale-105 animate-pulse-slow' 
                : stage === 'synced'
                ? 'bg-green-500/10 border-green-500'
                : 'bg-card border-border'
            } border-2 shadow-card`}>
              <Database className={`w-7 h-7 ${
                stage === 'drift_detected' 
                  ? 'text-yellow-500' 
                  : stage === 'synced'
                  ? 'text-green-500'
                  : 'text-muted-foreground'
              }`} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">postgresql_db</span>
          </div>
        </div>

        {/* Dynamic Center Alerts */}
        {stage === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[0.5px]">
            <span className="text-xs font-medium text-muted-foreground bg-card px-3 py-1.5 rounded-full border border-border/60">
              Ready to sync schemas
            </span>
          </div>
        )}

        {stage === 'drift_detected' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 animate-bounce">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium font-mono">1 drift detected: User.email type mismatch</span>
          </div>
        )}

        {stage === 'synced' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-elevated">
              <CheckCircle className="w-8 h-8 animate-bounce" />
              <span className="text-xs font-semibold">Schema Synced Successfully!</span>
              <span className="text-[10px] text-muted-foreground">Migration applied via safe Dry-Run confirmation</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
