'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Vector3 } from 'three';
import { 
  ArrowUpCircle,
  ArrowRightCircle, 
  ArrowLeftCircle,
  Save,
  Camera
} from 'lucide-react';

interface CameraPosition {
  position: Vector3;
  target: Vector3;
  fov: number;
}

interface CameraControlsProps {
  onUpdateCamera: (position: Vector3, target: Vector3) => void;
  onUpdateFov: (fov: number) => void;
  currentFov: number;
}

const CAMERA_PRESETS = {
  front: { position: new Vector3(0, 0, 5), target: new Vector3(0, 0, 0) },
  top: { position: new Vector3(0, 5, 0), target: new Vector3(0, 0, 0) },
  left: { position: new Vector3(-5, 0, 0), target: new Vector3(0, 0, 0) },
  right: { position: new Vector3(5, 0, 0), target: new Vector3(0, 0, 0) },
};

export default function CameraControls({ 
  onUpdateCamera, 
  onUpdateFov,
  currentFov 
}: CameraControlsProps) {
  const [savedPositions, setSavedPositions] = useState<CameraPosition[]>([]);

  const handlePresetClick = (preset: keyof typeof CAMERA_PRESETS) => {
    const { position, target } = CAMERA_PRESETS[preset];
    onUpdateCamera(position, target);
  };

  const handleFovChange = (value: number[]) => {
    onUpdateFov(value[0]);
  };

  return (
    <Card className="viewer-card">
      <CardHeader className="pb-3">
        <CardTitle className="viewer-title">Camera Presets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="default"
            onClick={() => handlePresetClick('front')}
            className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
          >
            <Camera className="h-4 w-4 mr-2" />
            Front
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={() => handlePresetClick('top')}
            className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
          >
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Top
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={() => handlePresetClick('left')}
            className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
          >
            <ArrowLeftCircle className="h-4 w-4 mr-2" />
            Left
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={() => handlePresetClick('right')}
            className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
          >
            <ArrowRightCircle className="h-4 w-4 mr-2" />
            Right
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="viewer-label">Field of View</Label>
            <span className="text-sm text-muted-foreground">{currentFov}°</span>
          </div>
          <div className="px-1">
            <Slider
              value={[currentFov]}
              onValueChange={handleFovChange}
              min={20}
              max={120}
              step={1}
              className="viewer-slider"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="secondary"
            size="default"
            className="w-full border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
            onClick={() => {
              // Save current camera position logic here
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Save View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 