'use client';

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
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SceneControlsProps {
  modelHeight: number;
  onModelHeightChange: (height: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
  gridVisible: boolean;
  onGridToggle: (visible: boolean) => void;
  onAddTextureClick?: () => void;
}

export function SceneControls({
  modelHeight,
  onModelHeightChange,
  fov,
  onFovChange,
  gridVisible,
  onGridToggle,
  onAddTextureClick,
}: SceneControlsProps) {
  const { isLocked } = useViewerStore();

  const handleModelHeightChange = (values: number[]) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to adjust model height.');
      return;
    }
    onModelHeightChange(values[0]);
  };

  const handleFovChange = (values: number[]) => {
    if (isLocked) {
      toast.error('Viewer is locked. Unlock to adjust field of view.');
      return;
    }
    onFovChange(values[0]);
  };

  return (
    <Card className="bg-[#1D1D1D] rounded-[20px] border-0 flex flex-col w-full p-4 gap-6">
      <CardTitle className="text-sm font-medium text-muted-foreground uppercase">SCENE</CardTitle>
      
      <div className="space-y-6"> 
        <div className="space-y-5"> 
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Model Offset</Label>
            <span className="text-sm font-medium text-muted-foreground">{modelHeight.toFixed(2)}</span>
          </div>
          <Slider
            value={[modelHeight]}
            onValueChange={handleModelHeightChange}
            min={0}
            max={5} 
            step={0.1}
            className="viewer-slider h-2" 
            disabled={isLocked}
          />
        </div>

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
            className="viewer-slider h-2" 
            disabled={isLocked}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Grid</Label>
          <Switch
            checked={gridVisible}
            onCheckedChange={onGridToggle}
            disabled={isLocked}
            className={cn(
              "peer inline-flex shrink-0 cursor-pointer items-center border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              "h-5 w-10 rounded-full p-[3px]",
              "data-[state=checked]:bg-[#C2F751]",
              "data-[state=unchecked]:bg-[#353535]",
              "[&>span]:h-3.5 [&>span]:w-3.5 [&>span]:rounded-full [&>span]:bg-[#1D1D1D]",
              "[&>span]:shadow-lg [&>span]:ring-0 [&>span]:transition-transform",
              "[&>span]:data-[state=checked]:translate-x-5",
              "[&>span]:data-[state=unchecked]:translate-x-0"
            )}
          />
        </div>

        <div>
           <Button 
             variant="secondary"
             className={cn(
                "w-full h-10 px-3 py-0 inline-flex items-center justify-center gap-2.5", 
                "rounded-xl border-0 bg-[#353535] shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)]",
                "hover:bg-[#404040]",
                "disabled:opacity-70 disabled:pointer-events-none",
                "text-sm text-foreground/80"
             )}
             onClick={onAddTextureClick}
             disabled={isLocked}
           >
             Add Texture
           </Button>
        </div>
      </div>
    </Card>
  );
} 