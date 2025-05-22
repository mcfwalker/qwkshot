'use client';

import React from 'react';
import { Button /*, buttonVariants*/ } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import { TakeInfoDisplay } from './TakeInfoDisplay';

interface PlaybackPanelProps {
  commands: CameraCommand[];
  isPlaying: boolean;
  isRecording: boolean;
  playbackSpeed: number;
  duration: number; // Actual duration calculated from commands
  progress: number; // <-- Add progress prop
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
/* // Removed SPEED_OPTIONS
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
*/

export const PlaybackPanel: React.FC<PlaybackPanelProps> = ({
  commands,
  isPlaying,
  isRecording,
  playbackSpeed,
  duration,
  progress,
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
    <div className="flex flex-col gap-6 h-full">
      
      <TakeInfoDisplay 
        hasCommands={hasCommands}
        takeCount={takeCount}
        animationName={modelName}
        className="w-full"
      />

      {/* Playback Speed Slider Section (Moved Up) */}
      <div className="space-y-5 w-full">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-[#CFD0D0]">Playback Speed</Label>
          <span className="text-sm font-medium text-[#CFD0D0]">
            {displayDuration.toFixed(1)}s 
          </span>
        </div>
        {/* Wrapper for slider and ticks/labels */}
        <div className="space-y-6">
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
                  "w-px h-4", // Increased tick height
                  index === 3 ? "bg-[#e2e2e2]" : "bg-[#444444]" // Highlight middle tick (1.0x) with #e2e2e2
                )}
              />
            ))}
          </div>
          {/* Min/Max Labels Below Ticks */}
          <div className="flex justify-between text-xs text-[#CFD0D0]/60">
            <span>0.25x</span>
            <span>2.0x</span>
          </div>
        </div>
      </div>

      {/* Play/Download Buttons Section (Moved Down) */}
      <div className="flex justify-between gap-4 w-full">
        <Button
          onClick={onPlayPause}
          variant="primary-light"
          size="xl"
          className={cn(
            "flex-1",
            "relative overflow-hidden"
          )}
          disabled={!hasCommands || isGenerating || isRecording}
        >
          {/* Progress Bar Div */}
          <div 
            className="absolute top-0 left-0 h-full bg-[#121212] z-0 transition-width duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
          {/* Icon (needs to be above progress bar) */}
          <span className="relative z-10 flex items-center justify-center w-full">
            <span className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              (!hasCommands || isGenerating || isRecording) ? "bg-transparent" : "bg-[#E2E2E2]"
            )}>
              {isPlaying ? <Pause className="h-5 w-5 text-[#121212]" /> : <Play className="h-5 w-5 text-[#121212]" />}
            </span>
          </span>
        </Button>
        <Button
          onClick={onDownload}
          variant="primary-light"
          size="xl"
          className="flex-1"
          disabled={!hasCommands || isPlaying || isRecording || isGenerating}
        >
          {isRecording ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5 text-[#121212]" />
          )}
        </Button>
      </div>

      {/* Create New Shot Button Section */}
      {/* Use flex-grow to push this button towards the bottom */}
      <div className="flex-grow flex items-end w-full"> 
        <Button
          variant="primary"
          className={cn(
            "w-full"
          )}
          size="default"
          onClick={onCreateNewShot}
          disabled={isGenerating || isRecording}
        >
          Unlock & Create New Shot
        </Button>
      </div>

    </div>
  );
}; 