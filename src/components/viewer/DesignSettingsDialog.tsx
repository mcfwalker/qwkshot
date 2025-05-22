'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from 'react';
import Colorful from '@uiw/react-color-colorful';
import { ColorResult } from '@uiw/react-color';

interface DesignSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  canvasBackgroundColor: string;
  onCanvasBackgroundColorChange: (color: string) => void;
  gridVisible: boolean;
  onGridVisibleChange: (visible: boolean) => void;
  gridColor: string;
  onGridColorChange: (color: string) => void;
}

export function DesignSettingsDialog({
  isOpen,
  onOpenChange,
  canvasBackgroundColor,
  onCanvasBackgroundColorChange,
  gridVisible,
  onGridVisibleChange,
  gridColor,
  onGridColorChange,
}: DesignSettingsDialogProps) {

  const [localCanvasBgHex, setLocalCanvasBgHex] = useState(canvasBackgroundColor);
  const [localGridColorHex, setLocalGridColorHex] = useState(gridColor);

  // States to control visibility of color pickers
  const [showCanvasPicker, setShowCanvasPicker] = useState(false);
  const [showGridPicker, setShowGridPicker] = useState(false);

  useEffect(() => {
    setLocalCanvasBgHex(canvasBackgroundColor);
  }, [canvasBackgroundColor]);

  useEffect(() => {
    setLocalGridColorHex(gridColor);
  }, [gridColor]);

  const handleCanvasBgColorChange = (color: ColorResult) => {
    setLocalCanvasBgHex(color.hex);
    onCanvasBackgroundColorChange(color.hex);
  };

  const handleGridColorChange = (color: ColorResult) => {
    setLocalGridColorHex(color.hex);
    onGridColorChange(color.hex);
  };

  const isValidHex = (hex: string) => /^#([0-9A-Fa-f]{3,4}){1,2}$/.test(hex);

  const handleCanvasHexBlur = () => {
    if (isValidHex(localCanvasBgHex)) {
      onCanvasBackgroundColorChange(localCanvasBgHex);
    } else {
      setLocalCanvasBgHex(canvasBackgroundColor);
    }
  };

  const handleGridHexBlur = () => {
    if (isValidHex(localGridColorHex)) {
      onGridColorChange(localGridColorHex);
    } else {
      setLocalGridColorHex(gridColor);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { 
      onOpenChange(open); 
      if (!open) {
        setShowCanvasPicker(false);
        setShowGridPicker(false);
      }
    }}>
      <DialogContent className="w-[216px] bg-[#1E1E1E] border-[#353535]">
        <DialogHeader>
          <DialogTitle className="text-[#e2e2e2]">Appearance</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {/* Canvas Background Color Section */}
          <div className="space-y-2">
            <Label htmlFor="canvasBgColorHex" className="text-[#e2e2e2]">Canvas</Label>
            <div className="relative flex items-center justify-between bg-[#0D0D0D] p-2 rounded-lg">
              <Input 
                id="canvasBgColorHex"
                value={localCanvasBgHex.startsWith('#') ? localCanvasBgHex.substring(1) : localCanvasBgHex}
                onChange={(e) => {
                  let val = e.target.value;
                  if (!val.startsWith('#')) {
                    val = '#' + val;
                  }
                  setLocalCanvasBgHex(val);
                }} 
                onBlur={handleCanvasHexBlur}
                className="bg-transparent border-none text-[#e2e2e2] flex-grow focus:outline-none focus:ring-0 p-0 text-sm"
                placeholder="121212"
                maxLength={7}
              />
              <div 
                className="w-7 h-7 rounded-md border border-[#353535] cursor-pointer flex-shrink-0"
                style={{ backgroundColor: localCanvasBgHex }}
                onClick={() => { setShowCanvasPicker(!showCanvasPicker); setShowGridPicker(false); }}
              />
              {showCanvasPicker && (
                <div className="absolute z-50 p-1 bg-[#2D2D2D] rounded-md shadow-lg" style={{ top: 'calc(100% + 8px)', right: '0px' }}>
                  <Colorful 
                    style={{ boxShadow: 'none' }}
                    color={localCanvasBgHex} 
                    onChange={handleCanvasBgColorChange} 
                    disableAlpha={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* New Group for Grid Controls with 16px internal spacing */}
          <div className="space-y-4">
            {/* Grid Color Section */}
            <div className="space-y-2">
              <Label htmlFor="gridColorHex" className="text-[#e2e2e2]">Grid</Label>
              <div className="relative flex items-center justify-between bg-[#0D0D0D] p-2 rounded-lg">
                <Input 
                  id="gridColorHex"
                  value={localGridColorHex.startsWith('#') ? localGridColorHex.substring(1) : localGridColorHex}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#')) {
                      val = '#' + val;
                    }
                    setLocalGridColorHex(val);
                  }}
                  onBlur={handleGridHexBlur}
                  className={`bg-transparent border-none text-[#e2e2e2] flex-grow focus:outline-none focus:ring-0 p-0 text-sm ${!gridVisible ? 'opacity-50' : ''}`}
                  placeholder="444444"
                  maxLength={7}
                  disabled={!gridVisible}
                />
                <div 
                  className={`w-7 h-7 rounded-md border border-[#353535] flex-shrink-0 ${gridVisible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                  style={{ backgroundColor: gridVisible ? localGridColorHex : '#555555' }}
                  onClick={() => { 
                    if (gridVisible) {
                      setShowGridPicker(!showGridPicker); setShowCanvasPicker(false); 
                    }
                  }}
                />
                {showGridPicker && gridVisible && (
                  <div className="absolute z-50 p-1 bg-[#2D2D2D] rounded-md shadow-lg" style={{ top: 'calc(100% + 8px)', right: '0px' }}>
                    <Colorful 
                      style={{ boxShadow: 'none' }}
                      color={localGridColorHex} 
                      onChange={handleGridColorChange} 
                      disableAlpha={true}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Grid Visibility Section - pt-4 removed, now part of the new group's space-y-4 */}
            <div className="flex items-center space-x-2"> 
              <Checkbox 
                id="gridVisibleCheckbox"
                checked={gridVisible}
                onCheckedChange={(checked) => onGridVisibleChange(checked as boolean)}
                className="border-[#888888] data-[state=checked]:bg-[#e2e2e2] data-[state=checked]:border-[#e2e2e2]"
              />
              <Label htmlFor="gridVisibleCheckbox" className="text-[#e2e2e2] cursor-pointer">
                Display Grid
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-8 flex">
          <Button 
            onClick={() => {
              // Reset canvas background color
              onCanvasBackgroundColorChange('#121212');
              setLocalCanvasBgHex('#121212');
              
              // Reset grid color
              onGridColorChange('#444444');
              setLocalGridColorHex('#444444');
              
              // Reset grid visibility to true (default)
              onGridVisibleChange(true);
              
              // Ensure pickers are closed if they were open
              setShowCanvasPicker(false);
              setShowGridPicker(false);
            }}
            className="bg-[#e2e2e2] text-[#121212] hover:bg-[#e2e2e2]/90 w-full"
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 