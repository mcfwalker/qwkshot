'use client';

import React from 'react';
// import { Card, CardContent } from '@/components/ui/card'; // Removed unused import
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { /*ChevronUp, ChevronDown, ChevronLeft, ChevronRight,*/ Move, Mouse, Target } from 'lucide-react'; // Removed unused Chevrons and added Target icon
import { cn } from '@/lib/utils';
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';

export interface CameraControlsPanelProps {
  fov: number;
  onFovChange: (fov: number) => void;
  // Placeholder handlers - to be implemented in Viewer.tsx
  // onCameraMove?: (direction: 'up' | 'down' | 'left' | 'right', active: boolean) => void; // Removed unused prop
  onCameraReset?: () => void;
}

export const CameraControlsPanelComponent: React.FC<CameraControlsPanelProps> = ({
  fov,
  onFovChange,
  // onCameraMove = () => console.warn('onCameraMove not implemented'), // Removed unused prop
  onCameraReset = () => console.warn('onCameraReset not implemented'),
}: CameraControlsPanelProps) => {
  const { isLocked } = useViewerStore(); // Needed to disable controls when locked

  const handleFovChange = (values: number[]) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to adjust field of view.');
      return;
    }
    onFovChange(values[0]);
  };

  // Handlers for D-Pad buttons (using onPointerDown/Up for hold support)
  /* // Removed unused handleMove function
  const handleMove = (direction: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to move camera.');
      return;
    }
    onCameraMove(direction, active);
  };
  */

  const handleReset = () => {
     if (isLocked) {
      toast.error('Viewer is locked. Unlock to reset camera.');
      return;
    }
    onCameraReset();
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      
      {/* Instructions Section (Moved Up) */}
      <div className="flex w-[168px] p-4 flex-col justify-center items-center gap-4 rounded-lg bg-[#121212]">
        {/* Mouse Instructions */}
        <div className="flex items-center gap-3 self-stretch">
          <Mouse className="h-5 w-5 text-foreground/80" />
          <div className="flex flex-col">
            <span className="text-sm text-foreground">Orbit & zoom</span>
          </div>
        </div>
        {/* Divider */}
        <div className="h-px w-full bg-[#353535]"></div>
        {/* Keyboard Instructions */}
        <div className="flex items-center gap-3 self-stretch">
          <Move className="h-5 w-5 text-foreground/80" /> 
          <div className="flex flex-col">
            <span className="text-sm text-foreground">Move</span>
          </div>
        </div>
      </div>

      {/* FOV Slider Section (Moved Down) */}
      <div className="space-y-5"> 
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">FOV</Label>
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

      {/* Reset Button Section (Remains at bottom) */}
      <Button 
        variant="primary"
        className={cn(
          "w-full"
        )}
        disabled={isLocked}
        onClick={handleReset}
      >
        <Target className="h-4 w-4 mr-2" />
        Recenter
      </Button>

      {/* Placeholder for Coordinate Display */}
      {/* <div className="text-xs text-muted-foreground text-center">Coordinates Placeholder</div> */}

    </div>
  );
}

export const CameraControlsPanel = React.memo(CameraControlsPanelComponent);

// Add this to your globals.css or a relevant CSS file if needed:
/* 
.dpad-button {
  @apply w-10 h-10 p-0 flex items-center justify-center rounded-lg bg-[#353535] border-0 text-foreground/80 shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)] hover:bg-[#404040] disabled:opacity-70 disabled:pointer-events-none;
}
*/ 