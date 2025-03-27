'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import { FloorType } from './Floor';
import { TextureLibraryPortal } from './TextureLibraryPortal';
import { GridToggle } from '@/components/ui/grid-toggle';

interface FloorControlsProps {
  onFloorTypeChange: (type: FloorType) => void;
  onFloorTextureChange: (textureUrl: string | null) => void;
  currentFloorType: FloorType;
}

export default function FloorControls({
  onFloorTypeChange,
  onFloorTextureChange,
  currentFloorType
}: FloorControlsProps) {
  const [showTextureModal, setShowTextureModal] = useState(false);
  const [hasTexture, setHasTexture] = useState(false);

  // Handle grid toggle
  const handleGridToggle = (checked: boolean) => {
    onFloorTypeChange(checked ? 'grid' : 'none');
  };

  // Handle texture selection
  const handleTextureSelect = (texture: any) => {
    setHasTexture(true);
    onFloorTextureChange(texture.file_url);
  };

  // Handle texture removal
  const handleRemoveTexture = () => {
    setHasTexture(false);
    onFloorTextureChange(null);
  };

  return (
    <div className="space-y-6">
      {/* Grid Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono">Grid</span>
        <GridToggle
          checked={currentFloorType === 'grid'}
          onCheckedChange={handleGridToggle}
        />
      </div>

      {/* Texture Controls */}
      <div>
        {!hasTexture ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowTextureModal(true)}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Add Texture
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="w-full bg-black/20 border-[0.5px] border-[#444444] hover:bg-black/40 transition-colors text-destructive hover:text-destructive"
            onClick={handleRemoveTexture}
          >
            Remove Texture
          </Button>
        )}
      </div>

      {/* Texture Modal */}
      <TextureLibraryPortal
        isOpen={showTextureModal}
        onClose={() => setShowTextureModal(false)}
        onSelect={handleTextureSelect}
      />
    </div>
  );
} 