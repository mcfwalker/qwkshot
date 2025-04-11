'use client';

import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CameraCommand } from '@/types/p2p/scene-interpreter';

interface PlaybackPanelProps {
  commands: CameraCommand[];
  isPlaying: boolean;
  isRecording: boolean;
  playbackSpeed: number;
  duration: number; // Actual duration calculated from commands
  takeCount: number;
  modelName: string | null;
  // isConfirmingClear: boolean; // Removed
  isGenerating: boolean; // Still needed to disable controls during generation
  onPlayPause: () => void;
  onDownload: () => void;
  onSpeedChange: (values: number[]) => void;
  // onProgressChange: (values: number[]) => void; // Removed - slider updates speed, not progress here
  onCreateNewShot: () => void;
  // onClearScene: () => void; // Removed
}

// Keep speed options if needed for slider logic, though direct values are used now
const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  // { value: 0.5, label: '0.5x' },
  // { value: 0.75, label: '0.75x' },
  // { value: 1, label: '1x' },
  // { value: 1.25, label: '1.25x' },
  // { value: 1.5, label: '1.5x' },
  // { value: 1.75, label: '1.75x' },
  { value: 2, label: '2.0x' }
];

export const PlaybackPanel: React.FC<PlaybackPanelProps> = ({
  commands,
  isPlaying,
  isRecording,
  playbackSpeed,
  duration,
  takeCount,
  modelName,
  isGenerating,
  onPlayPause,
  onDownload,
  onSpeedChange,
  onCreateNewShot,
}) => {
  const hasCommands = commands.length > 0;
  // Calculate display duration based on playback speed
  const displayDuration = hasCommands ? (duration / playbackSpeed) : 0;

  return (
    // Main container - Revert padding to p-0
    <div className="flex flex-col p-0 gap-6 h-full"> 
      
      {/* Take Label Section - Updated Structure */}
      <div 
        className={cn(
          "flex items-stretch w-full h-[64px] rounded-2xl bg-[#121212] overflow-hidden", // Changed rounded-lg to rounded-2xl
        )}
      >
        {/* Left Section (Take Count) */}
        <div className="flex items-center px-4 border-r border-[#1d1d1d] flex-shrink-0">
          <span className="text-sm font-medium text-foreground">
            TAKE {hasCommands ? takeCount : 0}
          </span>
        </div>
        {/* Right Section (Model Name / Placeholder) */}
        <div className="flex items-center px-4 flex-grow min-w-0">
          <span className={cn(
            "text-sm font-medium block",
            "overflow-hidden whitespace-nowrap text-ellipsis",
            hasCommands ? "text-foreground" : "text-foreground/60"
          )}>
            {hasCommands ? (modelName || 'Untitled Shot') : 'No animation loaded'}
          </span>
        </div>
      </div>

      {/* Play/Download Buttons Section */}
      <div className="flex justify-between gap-4">
        <Button
          onClick={onPlayPause}
          variant="primary" // Use primary variant
          size="lg" // Use larger size for 48px height
          className="flex-1 h-14 rounded-2xl disabled:cursor-not-allowed" // Added disabled cursor
          disabled={!hasCommands || isGenerating || isRecording}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button
          onClick={onDownload}
          variant="primary" // Use primary variant
          size="lg" // Use larger size
          className="flex-1 h-14 rounded-2xl disabled:cursor-not-allowed" // Added disabled cursor
          disabled={!hasCommands || isPlaying || isRecording || isGenerating}
        >
          {isRecording ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Video className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Playback Speed Slider Section */}
      {/* Apply space-y-5 like SceneControls */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground/80">Playback Speed</Label>
          <span className="text-sm font-medium text-foreground/80">
            {displayDuration.toFixed(1)}s 
          </span>
        </div>
        {/* Wrapper for slider and ticks/labels */}
        <div className="space-y-4">
          <Slider
            value={[playbackSpeed]}
            onValueChange={onSpeedChange}
            min={0.25}
            max={2}
            step={0.25}
            className="viewer-slider h-2 disabled:cursor-not-allowed" // Added disabled cursor
            disabled={!hasCommands || isPlaying || isRecording || isGenerating}
          />
          {/* Tick Marks Container - remove pt-1 */}
          <div className="flex justify-between px-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-px h-2", // Tick dimensions
                  index === 3 ? "bg-[#bef264]" : "bg-[#444444]" // Highlight middle tick (1.0x)
                )}
              />
            ))}
          </div>
          {/* Min/Max Labels Below Ticks */}
          <div className="flex justify-between text-xs text-foreground/60">
            <span>0.25x</span>
            <span>2.0x</span>
          </div>
        </div>
      </div>

      {/* Create New Shot Button Section */}
      {/* Use flex-grow to push this button towards the bottom */}
      <div className="flex-grow flex items-end"> 
        <Button
          variant="secondary" // Use secondary variant
          // Apply styles consistent with Library/Add Texture buttons
          className={cn(
            "w-full h-10 px-3 py-0 inline-flex items-center justify-center gap-2.5", // Size, padding, flex
            "rounded-xl border-0 bg-[#353535] shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)]", // Appearance
            "hover:bg-[#404040]", // Hover state
            "disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed", // Added disabled cursor
            "text-sm text-foreground/80" // Text style
          )}
          onClick={onCreateNewShot}
          disabled={isGenerating || isRecording} // Keep existing disable logic
        >
          Create New Shot
        </Button>
      </div>

    </div>
  );
}; 