import React from 'react';
import { cn } from '@/lib/utils';

interface AppPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const AppPanel = ({ children, className, ...props }: AppPanelProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-6 p-4",
        "bg-[#1D1D1D] rounded-xl",
        "border-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}; 