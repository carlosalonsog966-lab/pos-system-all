import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'text' | 'circle';
}

export default function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const base = 'bg-gray-200 dark:bg-gray-700 animate-pulse';
  const shape =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded h-4'
      : 'rounded';

  return <div className={`${base} ${shape} ${className}`} />;
}

