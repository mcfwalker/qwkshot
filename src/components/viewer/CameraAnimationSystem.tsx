'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Clock, Wand2, Loader2, Video, Square, RefreshCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Vector3, Object3D, PerspectiveCamera } from 'three';
import { toast } from 'sonner';
import { analyzeScene, SceneGeometry } from '@/lib/scene-analysis';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

interface CameraKeyframe {
  position: Vector3;
  target: Vector3;
  duration: number;
}

interface CameraAnimationSystemProps {
  onAnimationUpdate: (progress: number) => void;
  onAnimationStop: () => void;
  onAnimationStart: () => void;
  onAnimationPause: (progress: number) => void;
  isPlaying: boolean;
  duration: number;
  setDuration: (duration: number) => void;
  modelRef: React.RefObject<Object3D | null>;
  cameraRef: React.RefObject<PerspectiveCamera>;
  controlsRef: React.RefObject<any>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

const CameraSystemFallback = () => (
  <Card>
    <CardHeader>
      <CardTitle>Camera System Error</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The camera animation system encountered an error. Please try reloading the component.
      </p>
      <Button 
        variant="outline" 
        className="w-full"
        onClick={() => window.location.reload()}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Reload System
      </Button>
    </CardContent>
  </Card>
);

export const CameraAnimationSystem: React.FC<CameraAnimationSystemProps> = (props) => {
  return (
    <ErrorBoundary 
      name="CameraAnimationSystem"
      fallback={<CameraSystemFallback />}
    >
      <CameraAnimationSystemInner {...props} />
    </ErrorBoundary>
  );
};

const CameraAnimationSystemInner: React.FC<CameraAnimationSystemProps> = ({
  onAnimationUpdate,
  onAnimationStop,
  onAnimationStart,
  onAnimationPause,
  isPlaying,
  duration,
  setDuration,
  modelRef,
  cameraRef,
  controlsRef,
  canvasRef,
}) => {
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const progressRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Update the ref whenever progress changes
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      if (isPlaying && keyframes.length > 0) {
        const newProgress = progressRef.current + (100 / duration) * deltaTime;
        
        if (newProgress >= 100) {
          setProgress(0);
          onAnimationStop();
        } else {
          setProgress(newProgress);
          // Interpolate between keyframes based on progress
          const normalizedProgress = newProgress / 100;
          const totalDuration = keyframes.reduce((sum: number, kf: CameraKeyframe) => sum + kf.duration, 0);
          let currentTime = normalizedProgress * totalDuration;
          
          let currentKeyframeIndex = 0;
          let accumulatedDuration = 0;
          
          // Find the current keyframe pair
          while (currentKeyframeIndex < keyframes.length - 1 && 
                 accumulatedDuration + keyframes[currentKeyframeIndex].duration < currentTime) {
            accumulatedDuration += keyframes[currentKeyframeIndex].duration;
            currentKeyframeIndex++;
          }
          
          const k1 = keyframes[currentKeyframeIndex];
          const k2 = keyframes[Math.min(currentKeyframeIndex + 1, keyframes.length - 1)];
          
          // Calculate local progress within current keyframe pair
          const localProgress = (currentTime - accumulatedDuration) / k1.duration;
          
          // Interpolate position and target
          const position = new Vector3().lerpVectors(
            k1.position,
            k2.position,
            Math.min(localProgress, 1)
          );
          const target = new Vector3().lerpVectors(
            k1.target,
            k2.target,
            Math.min(localProgress, 1)
          );
          
          onAnimationUpdate(normalizedProgress);
          
          // Update camera position and target
          if (cameraRef.current && controlsRef.current) {
            cameraRef.current.position.copy(position);
            controlsRef.current.target.copy(target);
          }
        }
          
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying && keyframes.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration, keyframes, onAnimationUpdate, onAnimationStop, cameraRef, controlsRef]);

  const handleGeneratePath = async () => {
    if (!instruction.trim() || !modelRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }

    setIsGenerating(true);
    try {
      // Analyze the current scene
      const sceneGeometry = analyzeScene(modelRef.current);
      
      // Add current camera information
      sceneGeometry.currentCamera = {
        position: {
          x: cameraRef.current.position.x,
          y: cameraRef.current.position.y,
          z: cameraRef.current.position.z
        },
        target: {
          x: controlsRef.current.target.x,
          y: controlsRef.current.target.y,
          z: controlsRef.current.target.z
        },
        modelOrientation: {
          front: { x: 0, y: 0, z: 1 }, // Default front direction
          up: { x: 0, y: 1, z: 0 }     // Default up direction
        }
      };

      // Call the API to generate camera path
      const response = await fetch('/api/camera-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instruction,
          sceneGeometry
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate camera path');
      }

      const data = await response.json();
      
      // Convert API response to keyframes with Vector3 objects
      const newKeyframes = data.keyframes.map((kf: any) => ({
        position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
        target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
        duration: kf.duration
      }));

      setKeyframes(newKeyframes);
      
      // Update total duration based on keyframes
      const totalDuration = newKeyframes.reduce((sum: number, kf: CameraKeyframe) => sum + kf.duration, 0);
      setDuration(totalDuration);
      
      // Reset progress and start animation
      setProgress(0);
      onAnimationStart();
      
      toast.success('Camera path generated successfully');
    } catch (error) {
      console.error('Error generating camera path:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate camera path');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProgressChange = (value: number) => {
    if (!isPlaying && keyframes.length > 0) {
      setProgress(value);
      const normalizedProgress = value / 100;
      const totalDuration = keyframes.reduce((sum: number, kf: CameraKeyframe) => sum + kf.duration, 0);
      let currentTime = normalizedProgress * totalDuration;
      
      let currentKeyframeIndex = 0;
      let accumulatedDuration = 0;
      
      while (currentKeyframeIndex < keyframes.length - 1 && 
             accumulatedDuration + keyframes[currentKeyframeIndex].duration < currentTime) {
        accumulatedDuration += keyframes[currentKeyframeIndex].duration;
        currentKeyframeIndex++;
      }
      
      const k1 = keyframes[currentKeyframeIndex];
      const k2 = keyframes[Math.min(currentKeyframeIndex + 1, keyframes.length - 1)];
      
      const localProgress = (currentTime - accumulatedDuration) / k1.duration;
      
      const position = new Vector3().lerpVectors(
        k1.position,
        k2.position,
        Math.min(localProgress, 1)
      );
      const target = new Vector3().lerpVectors(
        k1.target,
        k2.target,
        Math.min(localProgress, 1)
      );
      
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(position);
        controlsRef.current.target.copy(target);
      }
    }
  };

  const startRecording = async () => {
    if (!canvasRef?.current) {
      toast.error('Canvas not available for recording');
      return;
    }

    try {
      const stream = canvasRef.current.captureStream(60);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000 // 5 Mbps
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'camera-path-animation.webm';
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setProgress(0);
      onAnimationStart();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onAnimationStop();
    }
  };

  useEffect(() => {
    // Stop recording when animation completes
    if (isRecording && progress >= 100) {
      stopRecording();
    }
  }, [isRecording, progress]);

  const handlePlayPause = () => {
    if (isPlaying) {
      onAnimationPause(progress);
    } else {
      onAnimationStart();
    }
  };

  const handleReset = () => {
    setProgress(0);
    onAnimationStop();
  };

  return (
    <Card className="viewer-panel">
      <CardHeader className="viewer-panel-header px-2">
        <CardTitle className="viewer-panel-title">Camera Path</CardTitle>
      </CardHeader>
      <CardContent className="viewer-panel-content">
        <div className="space-y-4">
          <Textarea
            placeholder="Describe the camera movement you want (e.g., 'Orbit around the model focusing on the front!')"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <Button
            onClick={handleGeneratePath}
            disabled={isGenerating || !instruction.trim()}
            className="viewer-button w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="viewer-button-icon animate-spin" />
                Generating Path...
              </>
            ) : (
              <>
                <Wand2 className="viewer-button-icon" />
                Generate Path
              </>
            )}
          </Button>
        </div>

        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <Label className="viewer-label">Duration</Label>
            <span className="text-sm text-muted-foreground">{duration}s</span>
          </div>
          <Slider
            value={[duration]}
            onValueChange={(values) => setDuration(values[0])}
            min={1}
            max={10}
            step={0.5}
            className="viewer-slider"
            disabled={isPlaying}
          />
          <div className="flex justify-between gap-2">
            <Button
              onClick={handlePlayPause}
              className="viewer-button flex-1"
              disabled={keyframes.length === 0}
            >
              {isPlaying ? (
                <Pause className="viewer-button-icon" />
              ) : (
                <Play className="viewer-button-icon" />
              )}
            </Button>
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className="viewer-button"
              disabled={keyframes.length === 0}
            >
              <Video className="viewer-button-icon" />
            </Button>
            <Button
              onClick={handleReset}
              className="viewer-button"
              disabled={!isPlaying && keyframes.length === 0}
            >
              <RefreshCcw className="viewer-button-icon" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 