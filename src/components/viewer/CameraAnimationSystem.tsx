'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Clock, Wand2, Loader2, Video, Square, RefreshCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Vector3, Object3D, PerspectiveCamera } from 'three';
import { toast } from 'sonner';
import { analyzeScene as analyzeSceneGeometry, SceneGeometry } from '@/lib/scene-analysis';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';

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
  onPathGenerated?: () => void;
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

// Create MetadataManagerFactory instance
const metadataManagerFactory = new MetadataManagerFactory({
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  trace: console.trace,
  performance: console.debug
});

// Create and initialize MetadataManager
const metadataManager = metadataManagerFactory.create({
  database: {
    type: 'supabase',
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  },
  caching: {
    enabled: true,
    ttl: 5 * 60 * 1000
  },
  validation: {
    strict: false,
    maxFeaturePoints: 100
  }
});

export const CameraAnimationSystem: React.FC<CameraAnimationSystemProps> = ({
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
  onPathGenerated,
}) => {
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([]);
  const [hasSetStartPosition, setHasSetStartPosition] = useState(false);
  const [modelId, setModelId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [inputDuration, setInputDuration] = useState(duration.toString());
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const progressRef = useRef(0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Generate UUID when model is loaded
  useEffect(() => {
    if (modelRef.current) {
      const pathParts = window.location.pathname.split('/');
      const existingUuid = pathParts.find(part => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
      );

      if (!existingUuid) {
        const newUuid = uuidv4();
        setModelId(newUuid);
        const newPath = `/viewer/${newUuid}`;
        window.history.pushState({}, '', newPath);
        console.log('Generated new UUID for model:', newUuid);
      } else {
        setModelId(existingUuid);
        console.log('Using existing UUID from URL:', existingUuid);
      }
    }
  }, [modelRef.current]);

  // Handle key press for setting start position
  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (event.key === 's' && !hasSetStartPosition && modelId) {
        try {
          if (!modelId) {
            toast.error('No valid model ID found');
            return;
          }

          // Analyze the current scene
          const sceneGeometry = analyzeSceneGeometry(modelRef.current as Object3D);
          
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

          // Store environmental metadata
          const environmentalMetadata: EnvironmentalMetadata = {
            lighting: {
              intensity: 1.0,
              color: '#ffffff',
              position: {
                x: 0,
                y: 10,
                z: 0
              }
            },
            camera: {
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
              fov: cameraRef.current.fov
            },
            scene: {
              background: '#000000',
              ground: '#808080',
              atmosphere: '#87CEEB'
            },
            constraints: {
              minDistance: sceneGeometry.safeDistance.min,
              maxDistance: sceneGeometry.safeDistance.max,
              minHeight: sceneGeometry.floor.height,
              maxHeight: sceneGeometry.boundingBox.max.y,
              maxSpeed: 2.0,
              maxAngleChange: 45,
              minFramingMargin: 0.1
            }
          };

          // Initialize and store metadata
          await metadataManager.initialize();
          await metadataManager.storeEnvironmentalMetadata(modelId, environmentalMetadata);
          
          setHasSetStartPosition(true);
          toast.success('Camera start position set!');
        } catch (error) {
          console.error('Failed to set camera start position:', error);
          toast.error('Failed to set camera start position');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [modelRef, cameraRef, controlsRef, modelId, hasSetStartPosition]);

  const handleGeneratePath = async () => {
    if (!hasSetStartPosition) {
      toast.error('Please set a camera start position first (press "s"');
      return;
    }
    if (!instruction.trim() || !modelRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }

    setIsGenerating(true);
    try {
      if (!modelRef.current) {
        throw new Error('Model reference is not available');
      }
      
      // Analyze the current scene
      const sceneGeometry = analyzeSceneGeometry(modelRef.current as Object3D);
      
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

      // Get the model ID from the URL - ensure it's a valid UUID
      const pathParts = window.location.pathname.split('/');
      const modelId = pathParts.find(part => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
      );
      
      if (!modelId) {
        throw new Error('No valid model ID found in URL');
      }

      // Call the API to generate camera path
      const response = await fetch('/api/camera-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instruction,
          sceneGeometry,
          duration: parseFloat(inputDuration),
          modelId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate camera path');
      }

      const data = await response.json();
      console.log('Camera path API response:', data);
      
      // Validate that we have keyframes data
      if (!data.keyframes) {
        throw new Error('Missing keyframes in API response');
      }
      
      // Ensure keyframes is an array
      const keyframesArray = Array.isArray(data.keyframes) 
        ? data.keyframes 
        : [];
        
      if (keyframesArray.length === 0) {
        throw new Error('No keyframes returned from API');
      }
      
      // Parse keyframes into Vector3 objects
      const newKeyframes = [];
      for (let i = 0; i < keyframesArray.length; i++) {
        const kf = keyframesArray[i];
        try {
          newKeyframes.push({
            position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
            target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
            duration: kf.duration
          });
        } catch (err) {
          console.error(`Error parsing keyframe ${i}:`, kf, err);
          // Skip invalid keyframes rather than failing completely
        }
      }
      
      if (newKeyframes.length === 0) {
        throw new Error('Failed to parse any valid keyframes');
      }

      setKeyframes(newKeyframes);
      
      // Update total duration based on keyframes
      const totalDuration = newKeyframes.reduce((sum: number, kf: CameraKeyframe) => sum + kf.duration, 0);
      setDuration(totalDuration);
      
      // Reset progress and start animation
      setProgress(0);
      onAnimationStart();
      
      // Notify that a path has been generated
      onPathGenerated?.();
      
      toast.success('Camera path generated successfully');
    } catch (error) {
      console.error('Error generating camera path:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate camera path');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProgressChange = (values: number[]) => {
    const value = values[0];
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

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputDuration(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
      setDuration(numValue);
    }
  };

  const handleDurationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numValue = parseFloat(inputDuration);
    if (isNaN(numValue) || numValue < 1) {
      setInputDuration('1');
      setDuration(1);
    } else if (numValue > 20) {
      setInputDuration('20');
      setDuration(20);
    } else {
      setInputDuration(numValue.toString());
      setDuration(numValue);
    }
  };

  return (
    <ErrorBoundary 
      name="CameraAnimationSystem"
      fallback={<CameraSystemFallback />}
    >
      <Card className="viewer-panel">
        <CardHeader className="viewer-panel-header px-2">
          <CardTitle className="viewer-panel-title">Camera Path</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-6">
          <div className="camera-path-fields">
            <Textarea
              placeholder="Describe the camera movement you want (e.g., 'Orbit around the model focusing on the front!')"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onFocus={() => setIsPromptFocused(true)}
              onBlur={() => setIsPromptFocused(false)}
              className="min-h-[140px] resize-none"
              active={isPromptFocused}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="duration-input" className="viewer-label">Path Duration</Label>
                <div className="w-20">
                  <Input
                    id="duration-input"
                    type="number"
                    value={inputDuration}
                    onChange={handleDurationChange}
                    onBlur={(e) => {
                      handleDurationBlur(e);
                      setIsPromptFocused(false);
                    }}
                    onFocus={() => setIsPromptFocused(true)}
                    min={1}
                    max={20}
                    step={0.5}
                    className="text-right"
                    disabled={isPlaying}
                    active={isPromptFocused}
                  />
                </div>
              </div>
              <p className="text-xs text-[#444444] italic text-right">Max 20 sec</p>
            </div>

            <div className="mt-8">
              <Button
                onClick={handleGeneratePath}
                disabled={isGenerating || !instruction.trim()}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Generating Path...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-6 w-6" />
                    Generate Path
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}; 