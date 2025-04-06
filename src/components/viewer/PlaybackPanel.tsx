'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Video, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

interface PlaybackPanelProps {
  commands: CameraCommand[];
  isPlaying: boolean;
  isRecording: boolean;
  playbackSpeed: number;
  duration: number;
  takeCount: number;
  modelName: string | null;
  isConfirmingClear: boolean;
  isGenerating: boolean;
  onPlayPause: () => void;
  onDownload: () => void;
  onSpeedChange: (values: number[]) => void;
  onProgressChange: (values: number[]) => void;
  onCreateNewShot: () => void;
  onClearScene: () => void;
}

const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25' },
  { value: 0.5, label: '0.5' },
  { value: 0.75, label: '0.75' },
  { value: 1, label: '1' },
  { value: 1.25, label: '1.25' },
  { value: 1.5, label: '1.5' },
  { value: 1.75, label: '1.75' },
  { value: 2, label: '2' }
];

export const PlaybackPanel: React.FC<PlaybackPanelProps> = (props) => (
  <div className="space-y-5">
    {/* Take # Display */}
    <div className="bg-[#2a2a2a] rounded-full px-4 py-2 text-sm text-center text-foreground/80">
      {props.commands.length > 0 ? `Take ${props.takeCount}: ${props.modelName || 'Untitled'}` : "No shot available"}
    </div>
    
    {/* Controls */}
    <div className="space-y-6"> 
      {/* Play/Download Buttons */}
      <div className="flex justify-between gap-4"> 
        <Button 
          onClick={props.onPlayPause} 
          variant="secondary" 
          size="icon" 
          className={cn(
            "flex-1 h-9 rounded-md", // Adjusted height/rounding
            "border border-[#555555] bg-[#2a2a2a] hover:bg-[#3a3a3a]", 
            "disabled:opacity-50 disabled:pointer-events-none",
            // Style for when playable
            props.commands.length > 0 && !props.isGenerating && "bg-[#bef264] text-black hover:bg-[#bef264]/90 border-transparent"
            )}
          disabled={!props.commands.length || props.isGenerating}
        >
          {props.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button 
          onClick={props.onDownload} 
          variant="secondary" 
          size="default" 
          disabled={!props.commands.length || props.isPlaying || props.isRecording}
          // Adjusted height/rounding, keep text centered
          className="flex-1 h-9 rounded-md border border-[#555555] bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:pointer-events-none text-xs px-3" 
        >
          {props.isRecording ? 
            (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Recording...</>) : // Adjusted margin
            (<><Video className="h-4 w-4 mr-1" /> Download</>)} 
        </Button>
      </div>
      
      {/* Speed Slider */} 
      <div className="space-y-1"> {/* Reduced spacing */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Playback Speed</Label>
          {/* Make value match label style */}
          <span className="text-sm font-medium text-muted-foreground">
            {(props.duration / props.playbackSpeed).toFixed(1)}s
          </span>
        </div>
        <div className="playback-speed-slider relative pt-2">
           <Slider 
             value={[props.playbackSpeed]} 
             onValueChange={props.onSpeedChange} 
             min={0.25} max={2} step={0.25} 
             className="viewer-slider" 
             disabled={props.isPlaying || !props.commands.length || props.isRecording}
           />
           {/* Adjusted label style/spacing */}
           <div className="flex justify-between text-xs text-[#888888] mt-1 px-1">
             <span>0.25x</span>
             <span>Normal</span>
             <span>2.0x</span>
           </div>
        </div>
      </div>
      
      {/* Action Buttons */} 
      <div className="flex justify-between pt-2"> {/* Reduced padding */}
        <Button 
          variant="ghost" size="sm" 
          onClick={props.onCreateNewShot} 
          className="text-muted-foreground hover:text-foreground px-1 h-7 text-xs" // Adjusted padding/height/text size
        >
           Create new shot 
        </Button>
        <Button 
          variant="ghost" size="sm" 
          onClick={props.onClearScene} 
          className={cn(
            "text-muted-foreground hover:text-destructive px-1 h-7 text-xs", // Adjusted styles
            props.isConfirmingClear && "text-destructive font-semibold" 
          )}
        >
           {props.isConfirmingClear ? 
             (<><X className="h-3 w-3 mr-1" /> Confirm Clear</>) : // Adjusted icon size/margin
             ("Clear Scene")}
        </Button>
      </div>
    </div>
  </div>
); 