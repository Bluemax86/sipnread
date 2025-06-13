
'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalLoadingIndicatorProps {
  isLoading: boolean;
}

export function GlobalLoadingIndicator({ isLoading }: GlobalLoadingIndicatorProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300',
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-live="assertive"
      aria-busy="true"
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-lg text-foreground">Loading...</p>
    </div>
  );
}
