import React from 'react';
import { cn } from '@/lib/utils';

export default function ConfidenceGauge({ score, size = 'md' }) {
  const radius = size === 'lg' ? 60 : size === 'md' ? 45 : 30;
  const strokeWidth = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getColor = () => {
    if (score >= 80) return { stroke: '#10b981', bg: '#d1fae5', text: 'text-emerald-600' };
    if (score >= 60) return { stroke: '#f59e0b', bg: '#fef3c7', text: 'text-amber-600' };
    return { stroke: '#ef4444', bg: '#fee2e2', text: 'text-red-600' };
  };

  const color = getColor();
  const viewBox = (radius + strokeWidth) * 2;
  const center = radius + strokeWidth;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={viewBox} height={viewBox} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color.bg}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          "font-bold",
          color.text,
          size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'
        )}>
          {score}%
        </span>
      </div>
    </div>
  );
}
