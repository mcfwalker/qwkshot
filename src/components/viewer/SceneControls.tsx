'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FloorType } from './Floor';
import FloorControls from './FloorControls';

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
            onValueChange={(values) => onModelHeightChange(values[0])}
            min={0}
            max={5}
            step={0.1}
            className="viewer-slider"
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
            onValueChange={(values) => onFovChange(values[0])}
            min={20}
            max={120}
            step={1}
            className="viewer-slider"
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