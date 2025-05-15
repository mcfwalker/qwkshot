'use client';

import React from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // CardTitle no longer used directly here in this way
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Not used
// import { FloorType } from './Floor'; // Not used
// import FloorControls from './FloorControls'; // Not used
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';
// import { Switch } from "@/components/ui/switch"; // Not used
import { Button } from "@/components/ui/button";
// import { Image as ImageIcon, PlusIcon, Trash2Icon } from "lucide-react"; // Not used
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { AppPanel } from "@/components/ui/AppPanel"; // IMPORT AppPanel

interface SceneControlsProps {
  gridVisible: boolean;
  onGridToggle: (visible: boolean) => void;
  onAddTextureClick?: () => void;
  texture?: string | null;
  onRemoveTexture?: () => void;
  userVerticalAdjustment: number;
  onUserVerticalAdjustmentChange: (value: number) => void;
}

export function SceneControlsComponent({
  gridVisible,
  onGridToggle,
  onAddTextureClick,
  texture,
  onRemoveTexture,
  userVerticalAdjustment,
  onUserVerticalAdjustmentChange
}: SceneControlsProps) {
  const { isLocked } = useViewerStore();

  const handleAdjustmentChange = (values: number[]) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to adjust model offset.');
      return;
    }
    onUserVerticalAdjustmentChange(values[0]);
  };

  return (
    <AppPanel className="w-[200px]"> {/* USE AppPanel with fixed width */}
      {/* Replaced CardTitle with a simple div for now, styling can be adjusted */}
      <div className="text-sm font-medium text-[#E2E2E5] uppercase self-start">SCENE</div>
      
      {/* Content remains largely the same, ensure w-full for inner elements if needed */}
      <div className="space-y-6 w-full"> {/* Added w-full here to ensure content stretches */}
        <div className="space-y-5"> 
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Model Offset</Label>
            <span className="text-sm font-medium text-muted-foreground">{userVerticalAdjustment.toFixed(2)}</span>
          </div>
          <Slider
            value={[userVerticalAdjustment]}
            onValueChange={handleAdjustmentChange}
            min={-2}
            max={5} 
            step={0.05}
            className="viewer-slider h-2 disabled:cursor-not-allowed"
            disabled={isLocked}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Grid</Label>
          <Checkbox
            checked={gridVisible}
            onCheckedChange={onGridToggle}
            disabled={isLocked}
            className="data-[state=checked]:bg-[#C2F751] data-[state=checked]:text-black"
          />
        </div>

        <div>
           <Button 
             variant="primary"
             className={cn(
                "w-full"
             )}
             onClick={texture ? onRemoveTexture : onAddTextureClick}
             disabled={isLocked}
           >
             {texture ? "Remove Texture" : "Add Texture"}
           </Button>
        </div>
      </div>
    </AppPanel>
  );
}

export const SceneControls = React.memo(SceneControlsComponent); 