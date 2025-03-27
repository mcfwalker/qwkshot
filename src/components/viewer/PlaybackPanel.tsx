'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Video, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PlaybackPanelProps {
  isPlaying: boolean;
  duration: number;
  onPlaybackSpeedChange: (speed: number) => void;
  onPlayPause: () => void;
  disabled: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  hasGeneratedPath?: boolean;
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

export function PlaybackPanel({
  isPlaying,
  duration,
  onPlaybackSpeedChange,
  onPlayPause,
  disabled,
  canvasRef,
  hasGeneratedPath = false
}: PlaybackPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleDownload = async () => {
    if (!canvasRef?.current) {
      toast.error('Canvas not available for recording');
      return;
    }

    try {
      // Check supported MIME types
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      if (!supportedType) {
        toast.error('No supported video recording format found');
        return;
      }

      // Get the canvas stream
      const stream = canvasRef.current.captureStream(30);
      
      // Create a MediaRecorder with the supported type
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        videoBitsPerSecond: 8000000
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Collect data chunks during recording
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          toast.error('No video data was recorded');
          setIsRecording(false);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: supportedType });
        
        // Only create download if we have data
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'camera-path-animation.webm';
          a.click();
          URL.revokeObjectURL(url);
        } else {
          toast.error('Generated video file was empty');
        }
        
        setIsRecording(false);
      };

      // Start recording
      setIsRecording(true);
      mediaRecorder.start(50); // Request data every 50ms

      // Start the animation
      onPlayPause();

      // Stop recording after duration + small buffer
      const recordingDuration = (duration * 1000) + 100; // Convert to ms and add 100ms buffer
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, recordingDuration);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const handleSpeedChange = (values: number[]) => {
    // Find the closest speed option to the slider value
    const value = values[0];
    const closestOption = SPEED_OPTIONS.reduce((prev, curr) => {
      return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
    });
    
    setPlaybackSpeed(closestOption.value);
    onPlaybackSpeedChange(closestOption.value);
  };

  // Get the current speed label
  const currentSpeedLabel = SPEED_OPTIONS.find(option => option.value === playbackSpeed)?.label || 'Normal';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <Card className="viewer-panel">
      <CardHeader className="viewer-panel-header">
        <CardTitle className="viewer-panel-title">Playback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-4 pb-6">
        <div className="flex justify-between gap-2">
          <Button
            onClick={onPlayPause}
            variant="secondary"
            size="icon"
            className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
            disabled={disabled || isRecording}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={handleDownload}
            variant="secondary"
            size="default"
            disabled={disabled || isPlaying || isRecording}
            className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
          >
            {isRecording ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="viewer-label">Playback Speed</Label>
            <span className="text-sm text-muted-foreground">{(duration / playbackSpeed).toFixed(1)}s</span>
          </div>
          <div className="playback-speed-slider">
            <div className="mark-container">
              {SPEED_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`mark ${option.value === 1 ? 'normal' : ''}`}
                  style={{
                    left: `${((option.value - 0.25) / (2 - 0.25)) * 100}%`
                  }}
                />
              ))}
            </div>
            <Slider
              value={[playbackSpeed]}
              onValueChange={handleSpeedChange}
              min={0.25}
              max={2}
              step={0.25}
              className="viewer-slider"
              disabled={isPlaying || disabled || isRecording}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-7">
              <span>0.25x</span>
              <span>2.0x</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 