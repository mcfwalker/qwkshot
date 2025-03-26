'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Grid, X, ImageIcon, Upload, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FloorType } from './Floor';
import { toast } from 'sonner';

interface SceneControlsProps {
  modelHeight: number;
  onModelHeightChange: (height: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
  floorType: FloorType;
  onFloorTypeChange: (type: FloorType) => void;
  onFloorTextureChange: (url: string) => void;
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
  const [uploadingTexture, setUploadingTexture] = useState(false);

  // Handle texture upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (jpg, png)');
      return;
    }

    try {
      setUploadingTexture(true);
      // Create object URL for the file
      const url = URL.createObjectURL(file);
      onFloorTextureChange(url);
      toast.success('Texture uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload texture');
    } finally {
      setUploadingTexture(false);
    }
  }, [onFloorTextureChange]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  });

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

        {/* Floor Type Control */}
        <div className="space-y-6">
          <Label>Floor Type</Label>
          <RadioGroup
            value={floorType}
            onValueChange={(value) => onFloorTypeChange(value as FloorType)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="grid" id="grid" />
              <Label htmlFor="grid">Grid</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="none" />
              <Label htmlFor="none">None</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="textured" id="textured" />
              <Label htmlFor="textured">Textured</Label>
            </div>
          </RadioGroup>

          {/* Texture Upload */}
          {floorType === 'textured' && (
            <div className="pt-2">
              <Button
                {...getRootProps()}
                disabled={uploadingTexture}
                variant="outline"
                className="w-full"
              >
                <input {...getInputProps()} />
                {uploadingTexture ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Texture
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 