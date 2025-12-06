'use client';

import { useEffect, useRef } from 'react';

interface TrendChartProps {
  data: Array<{ date: string; value: number }>;
  metric: string;
}

export default function TrendChart({ data, metric }: TrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on container
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width || 600;
      canvas.height = 200;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find min/max values
    const values = data.map((d) => d.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1) || 1;

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = (width / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = data.length > 1 ? (width / (data.length - 1)) * index : width / 2;
      const y = height - ((point.value - min) / (max - min || 1)) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#3b82f6';
    data.forEach((point, index) => {
      const x = data.length > 1 ? (width / (data.length - 1)) * index : width / 2;
      const y = height - ((point.value - min) / (max - min || 1)) * height;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="p-4 bg-card border rounded-lg">
        <h3 className="text-lg font-semibold mb-4 capitalize">{metric} Trend</h3>
        <p className="text-muted-foreground text-center py-8">No data available</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded-lg">
      <h3 className="text-lg font-semibold mb-4 capitalize">{metric} Trend</h3>
      <div className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full h-48"
        />
      </div>
    </div>
  );
}

