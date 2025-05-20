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
// import { Checkbox } from "@/components/ui/checkbox"; // Remove this line
import { Palette, Image } from 'lucide-react'; // Import Palette and Image icons
// import { AppPanel } from "@/components/ui/AppPanel"; // IMPORT AppPanel -- REMOVED

interface SceneControlsProps {
  // gridVisible: boolean; // Removed
  // onGridToggle: (visible: boolean) => void; // Removed
  onAddTextureClick?: () => void;
  texture?: string | null;
  onRemoveTexture?: () => void;
  userVerticalAdjustment: number;
  onUserVerticalAdjustmentChange: (value: number) => void;
  onOpenDesignDialog: () => void; // New prop to open design dialog
}

export function SceneControlsComponent({
  // gridVisible, // Removed
  // onGridToggle, // Removed
  onAddTextureClick,
  texture,
  onRemoveTexture,
  userVerticalAdjustment,
  onUserVerticalAdjustmentChange,
  onOpenDesignDialog, // Destructure new prop
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
    // <AppPanel className="w-[200px]"> {/* USE AppPanel with fixed width */}
    <div className="bg-[#1D1D1D] rounded-xl p-4 flex flex-col items-start gap-6 w-[200px]">
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

        {/* Grid toggle section removed 
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Grid</Label>
          <Checkbox
            checked={gridVisible}
            onCheckedChange={onGridToggle}
            disabled={isLocked}
            className="data-[state=checked]:bg-[#C2F751] data-[state=checked]:text-black"
          />
        </div>
        */}

        {/* Appearance Button - MOVED AND RESTYLED */}
        <div>
          <Button
            variant="primary"
            className="w-full"
            onClick={onOpenDesignDialog}
            disabled={isLocked}
          >
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </Button>
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
             <Image className="h-4 w-4 mr-2" />
             {texture ? "Remove Texture" : "Add Texture"}
           </Button>
        </div>
      </div>
    </div>
    // </AppPanel>
  );
}

export const SceneControls = React.memo(SceneControlsComponent); 