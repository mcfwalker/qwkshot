'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';

export interface CameraControlsPanelProps {
  fov: number;
  onFovChange: (fov: number) => void;
  // Placeholder handlers - to be implemented in Viewer.tsx
  onCameraMove?: (direction: 'up' | 'down' | 'left' | 'right', active: boolean) => void;
  onCameraReset?: () => void;
}

export function CameraControlsPanel({
  fov,
  onFovChange,
  onCameraMove = () => console.warn('onCameraMove not implemented'), // Default dummy handlers
  onCameraReset = () => console.warn('onCameraReset not implemented'),
}: CameraControlsPanelProps) {
  const { isLocked } = useViewerStore(); // Needed to disable controls when locked

  const handleFovChange = (values: number[]) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to adjust field of view.');
      return;
    }
    onFovChange(values[0]);
  };

  // Handlers for D-Pad buttons (using onPointerDown/Up for hold support)
  const handleMove = (direction: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to move camera.');
      return;
    }
    onCameraMove(direction, active);
  };

  const handleReset = () => {
     if (isLocked) {
      toast.error('Viewer is locked. Unlock to reset camera.');
      return;
    }
    onCameraReset();
  };

  return (
    <Card className="bg-[#1D1D1D] rounded-[20px] border-0 flex flex-col w-full p-4 gap-6">
      {/* FOV Slider Section */}
      <div className="space-y-5"> 
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Field Of View</Label>
          <span className="text-sm font-medium text-muted-foreground">{fov}°</span>
        </div>
        <Slider
          value={[fov]}
          onValueChange={handleFovChange}
          min={20}
          max={120}
          step={1}
          className="viewer-slider h-2 disabled:cursor-not-allowed"
          disabled={isLocked}
        />
      </div>

      {/* D-Pad Section */}
      <div 
        className="flex flex-col items-center justify-center gap-[18px] self-stretch p-4 rounded-lg bg-[#121212]"
      >
        {/* D-Pad Buttons - Using Grid for layout */}
        <div className="grid grid-cols-3 gap-1 w-[124px]"> {/* Adjust width/gap as needed */} 
          <div /> {/* Spacer */}
          <Button 
            variant="secondary" 
            size="icon" 
            className="dpad-button" 
            disabled={isLocked}
            onPointerDown={() => handleMove('up', true)}
            onPointerUp={() => handleMove('up', false)}
            onPointerLeave={() => handleMove('up', false)}
          >
            <ChevronUp size={16} />
          </Button>
          <div /> {/* Spacer */}
          <Button 
            variant="secondary" 
            size="icon" 
            className="dpad-button" 
            disabled={isLocked}
            onPointerDown={() => handleMove('left', true)}
            onPointerUp={() => handleMove('left', false)}
            onPointerLeave={() => handleMove('left', false)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button 
            variant="secondary" 
            size="icon" 
            className="dpad-button" 
            disabled={isLocked}
            onPointerDown={() => handleMove('down', true)}
            onPointerUp={() => handleMove('down', false)}
            onPointerLeave={() => handleMove('down', false)}
          >
            <ChevronDown size={16} />
          </Button>
          <Button 
            variant="secondary" 
            size="icon" 
            className="dpad-button" 
            disabled={isLocked}
            onPointerDown={() => handleMove('right', true)}
            onPointerUp={() => handleMove('right', false)}
            onPointerLeave={() => handleMove('right', false)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Tip: Arrow keys work too!</p>
      </div>

      {/* Reset Button Section */}
      <Button 
        variant="secondary" 
        className="dpad-button w-full" 
        disabled={isLocked}
        onClick={handleReset}
      >
        <Move size={16} /> {/* Reset Camera Icon */}
      </Button>

      {/* Placeholder for Coordinate Display */}
      {/* <div className="text-xs text-muted-foreground text-center">Coordinates Placeholder</div> */}

    </Card>
  );
}

// Add this to your globals.css or a relevant CSS file if needed:
/* 
.dpad-button {
  @apply w-10 h-10 p-0 flex items-center justify-center rounded-lg bg-[#353535] border-0 text-foreground/80 shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)] hover:bg-[#404040] disabled:opacity-70 disabled:pointer-events-none;
}
*/ 