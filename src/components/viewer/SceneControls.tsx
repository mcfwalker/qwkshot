'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FloorType } from './Floor';
import FloorControls from './FloorControls';
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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
    <Card className="bg-[#1D1D1D] rounded-xl border-0 flex flex-col w-full p-4 gap-6">
      <CardTitle className="text-sm font-medium text-[#C2F751] uppercase">SCENE</CardTitle>
      
      <div className="space-y-6"> 
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
             variant="secondary"
             className={cn(
                "flex h-[40px] px-6 justify-center items-center gap-[10px] self-stretch w-full",
                "rounded-[10px] border border-[#353535] bg-[#121212]",
                "hover:bg-[#353535]",
                "disabled:opacity-70 disabled:pointer-events-none",
                "text-sm text-foreground/80"
             )}
             onClick={texture ? onRemoveTexture : onAddTextureClick}
             disabled={isLocked}
           >
             {texture ? "Remove Texture" : "Add Texture"}
           </Button>
        </div>
      </div>
    </Card>
  );
}

export const SceneControls = React.memo(SceneControlsComponent); 