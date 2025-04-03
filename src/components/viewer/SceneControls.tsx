'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FloorType } from './Floor';
import FloorControls from './FloorControls';
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';

interface SceneControlsProps {
  modelHeight: number;
  onModelHeightChange: (height: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
  floorType: FloorType;
  onFloorTypeChange: (type: FloorType) => void;
  onFloorTextureChange: (url: string | null) => void;
}

export function SceneControls({
  modelHeight,
  onModelHeightChange,
  fov,
  onFovChange,
  floorType,
  onFloorTypeChange,
  onFloorTextureChange,
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
    <Card className="viewer-panel">
      <CardHeader className="viewer-panel-header px-2 pb-6 pt-5">
        <CardTitle className="viewer-panel-title">Scene</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-4 pb-6">
        {/* Model Height Control */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="viewer-label">Model Height</Label>
            <span className="text-sm text-muted-foreground">{modelHeight.toFixed(2)}</span>
          </div>
          <Slider
            value={[modelHeight]}
            onValueChange={handleModelHeightChange}
            min={0}
            max={5}
            step={0.1}
            className="viewer-slider"
            disabled={isLocked}
          />
        </div>

        {/* FOV Control */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="viewer-label">Field of View</Label>
            <span className="text-sm text-muted-foreground">{fov}°</span>
          </div>
          <Slider
            value={[fov]}
            onValueChange={handleFovChange}
            min={20}
            max={120}
            step={1}
            className="viewer-slider"
            disabled={isLocked}
          />
        </div>

        {/* Floor Controls */}
        <FloorControls
          currentFloorType={floorType}
          onFloorTypeChange={onFloorTypeChange}
          onFloorTextureChange={onFloorTextureChange}
        />
      </CardContent>
    </Card>
  );
} 