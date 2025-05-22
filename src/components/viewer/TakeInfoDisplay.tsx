import React from 'react';
import { cn } from '@/lib/utils';

export interface TakeInfoDisplayProps {
  hasCommands: boolean;
  takeCount: number;
  animationName?: string | null;
  className?: string;
}

export const TakeInfoDisplay: React.FC<TakeInfoDisplayProps> = ({
  hasCommands,
  takeCount,
  animationName,
  className,
}) => {
  return (
    <div
      className={cn(
        // Removed w-[256px] - component will now take parent's width or rely on passed className for width
        'flex items-center h-[64px] rounded-lg bg-[#121212] overflow-hidden',
        className
      )}
    >
      {/* Left Section (Take Count) */}
      <div className="flex items-center px-4 border-r border-[#353535] h-full flex-shrink-0">
        <span className="text-sm font-medium text-[#CFD0D0]">
          TAKE {hasCommands ? takeCount : 0}
        </span>
      </div>
      {/* Right Section (Animation Name / Placeholder) */}
      <div className="flex items-center px-4 flex-grow min-w-0 h-full">
        <span
          className={cn(
            "text-sm font-medium w-full", // w-full ensures it takes available space for ellipsis
            "overflow-hidden whitespace-nowrap text-ellipsis",
            hasCommands ? "text-[#CFD0D0]" : "text-[#CFD0D0]/60"
          )}
        >
          {hasCommands ? (animationName || 'Untitled Shot') : 'No animation loaded'}
        </span>
      </div>
    </div>
  );
}; 