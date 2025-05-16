import React from 'react';
import { Label } from "../ui/label"; // Adjusted import path relative to new location
import { Switch } from '../ui/switch'; // Adjusted import path relative to new location
import { cn } from '@/lib/utils';

export interface CameraLockSwitchProps {
  isLocked: boolean;
  onLockToggle: (locked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const CameraLockSwitch: React.FC<CameraLockSwitchProps> = ({
  isLocked,
  onLockToggle,
  disabled = false,
  label,
}) => {
  const defaultLabel = isLocked ? "Camera is Locked" : "Lock Start Position";
  const displayLabel = label || defaultLabel;

  return (
    <div
      className={`flex items-center justify-between self-stretch rounded-md bg-[#2E2E2E] p-4`}
    >
      <Label htmlFor="camera-lock-switch" className="text-sm text-[#E2E2E5]">
        {displayLabel}
      </Label>
      <div className="flex items-center justify-end min-w-[54px]">
        <Switch
          id="camera-lock-switch" // Added id for htmlFor
          checked={isLocked}
          onCheckedChange={onLockToggle}
          disabled={disabled}
          className={cn(
            "peer inline-flex h-[30px] p-[3px] w-[54px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:bg-[#C2F751]",
            "data-[state=unchecked]:bg-[#e2e2e2]",
            "[&>span]:pointer-events-none [&>span]:block [&>span]:h-6 [&>span]:w-6 [&>span]:rounded-full [&>span]:bg-[#121212] shadow-lg ring-0 transition-transform",
            "[&>span]:data-[state=checked]:translate-x-[20px]",
            "[&>span]:data-[state=unchecked]:translate-x-0"
          )}
        />
      </div>
    </div>
  );
}; 