'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, Clock, Wand2, Loader2, Video, Square, RefreshCcw, Camera, FileCode2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Vector3, Object3D, PerspectiveCamera, Mesh, Material, BufferGeometry } from 'three';
import { toast } from 'sonner';
import { analyzeScene as analyzeSceneGeometry, SceneGeometry } from '@/lib/scene-analysis';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { EnvironmentalMetadata } from '@/types/p2p/environmental-metadata';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { LockButton } from './LockButton';
import { useViewerStore } from '@/store/viewerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

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
  onPlaybackSpeedChange: (speed: number) => void;
  disabled?: boolean;
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

// Add speed options constant
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

// Update the generate path states type
type GeneratePathState = 'initial' | 'generating' | 'ready';

// Fun, cinematic-themed messages for the generating state
const generatingMessages = [
  "Setting up the perfect shot...",
  "Calculating cinematic angles...",
  "Choreographing the camera moves...",
  "Finding the dramatic moments...",
  "Making it look epic...",
  "Adding that cinematic magic...",
  "Crafting the perfect sequence...",
  "Directing your scene..."
];

// Update the generate path states configuration
const generatePathStates: Record<GeneratePathState, { text: string; icon: React.ReactNode }> = {
  initial: {
    text: "Generate Path",
    icon: <Wand2 className="h-6 w-6" />
  },
  generating: {
    text: generatingMessages[0],
    icon: <Loader2 className="h-6 w-6 animate-spin" />
  },
  ready: {
    text: "Ready for playback!",
    icon: null
  }
};

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
  onPlaybackSpeedChange,
  disabled,
}) => {
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [inputDuration, setInputDuration] = useState(duration.toString());
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [generatePathState, setGeneratePathState] = useState<GeneratePathState>('initial');
  const progressRef = useRef(0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { isLocked, toggleLock, storeEnvironmentalMetadata } = useViewerStore();
  const [messageIndex, setMessageIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [takeCount, setTakeCount] = useState(0);
  const [modelName, setModelName] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Debug logging for button state
  useEffect(() => {
    const buttonState = {
      isLocked,
      isGenerating,
      hasInstruction: !!instruction.trim(),
      isDisabled: !isLocked || isGenerating,
      instruction: instruction,
      instructionLength: instruction.length,
      instructionTrimmed: instruction.trim(),
      instructionTrimmedLength: instruction.trim().length
    };
    console.log('Detailed button state:', buttonState);
  }, [isLocked, isGenerating, instruction]);

  // Generate UUID when model is loaded
  useEffect(() => {
    if (modelRef.current) {
      const pathParts = window.location.pathname.split('/');
      const modelId = pathParts[pathParts.length - 1]; // Get the last segment of the path
      
      if (modelId) {
        setModelId(modelId);
        console.log('Using model ID from URL:', modelId);
      }
    }
  }, [modelRef.current]);

  // Add effect for cycling through messages during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isGenerating) {
      interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % generatingMessages.length);
      }, 2000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isGenerating]);

  const handleGeneratePath = async () => {
    if (!instruction.trim()) {
      toast.error('Please describe the camera movement you want');
      return;
    }

    // Early validation of required refs
    if (!modelRef?.current) {
      console.error('Model reference is not available');
      toast.error('Model not loaded properly');
      return;
    }

    if (!cameraRef?.current) {
      console.error('Camera reference is not available');
      toast.error('Camera not initialized properly');
      return;
    }

    if (!controlsRef?.current) {
      console.error('Controls reference is not available');
      toast.error('Camera controls not initialized properly');
      return;
    }

    setIsGenerating(true);
    setGeneratePathState('generating');
    setMessageIndex(0); // Reset message index
    
    try {
      // Get the model ID from the URL
      const pathParts = window.location.pathname.split('/');
      const modelId = pathParts[pathParts.length - 1];
      
      if (!modelId) {
        throw new Error('No model ID found in URL');
      }

      console.log('Fetching model details for ID:', modelId);

      // Fetch model name from Supabase
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('name')
        .eq('id', modelId)
        .single();

      if (modelError) {
        console.error('Failed to fetch model details:', modelError);
        throw new Error(`Failed to fetch model details: ${modelError.message}`);
      }

      if (!modelData || !modelData.name) {
        throw new Error('Invalid model data received');
      }

      console.log('Model data received:', modelData);
      setModelName(modelData.name);
      setTakeCount(prev => prev + 1);

      // Analyze the current scene
      const sceneGeometry = analyzeSceneGeometry(modelRef.current);
      
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
          front: { x: 0, y: 0, z: 1 },
          up: { x: 0, y: 1, z: 0 }
        }
      };
      
      // Call the API to generate camera path
      const pathResponse = await fetch('/api/camera-path', {
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

      if (!pathResponse.ok) {
        const error = await pathResponse.json();
        throw new Error(error.error || 'Failed to generate camera path');
      }

      const data = await pathResponse.json();
      
      // Validate and parse keyframes
      if (!data.keyframes) {
        throw new Error('Missing keyframes in API response');
      }
      
      const keyframesArray = Array.isArray(data.keyframes) ? data.keyframes : [];
      if (keyframesArray.length === 0) {
        throw new Error('No keyframes returned from API');
      }
      
      // Parse keyframes into Vector3 objects
      const newKeyframes = [];
      for (let i = 0; i < keyframesArray.length; i++) {
        const kf = keyframesArray[i];
        try {
          const keyframe = {
            position: new Vector3(kf.position.x, kf.position.y, kf.position.z),
            target: new Vector3(kf.target.x, kf.target.y, kf.target.z),
            duration: kf.duration
          };
          newKeyframes.push(keyframe);
        } catch (err) {
          console.error(`Error parsing keyframe ${i}:`, kf, err);
        }
      }

      setKeyframes(newKeyframes);
      const totalDuration = newKeyframes.reduce((sum, kf) => sum + kf.duration, 0);
      setDuration(totalDuration);
      setProgress(0);
      setGeneratePathState('ready');
      onAnimationStart();
      onPathGenerated?.();
      
      toast.success('Camera path generated successfully');
    } catch (error) {
      console.error('Error generating camera path:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate camera path');
      setGeneratePathState('initial');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnimationStart = () => {
    console.log('Animation starting...', {
      keyframesCount: keyframes.length,
      totalDuration: keyframes.reduce((sum, kf) => sum + kf.duration, 0),
      hasCamera: !!cameraRef.current,
      hasControls: !!controlsRef.current
    });
    onAnimationStart();
  };

  const handleProgressChange = (values: number[]) => {
    const value = values[0];
    console.log('Progress update:', {
      value,
      isPlaying,
      keyframesPresent: keyframes.length > 0
    });
    
    if (!isPlaying && keyframes.length > 0) {
      setProgress(value);
      const normalizedProgress = value / 100;
      const totalDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
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

      console.log('Camera update:', {
        position: position.toArray(),
        target: target.toArray(),
        currentKeyframeIndex,
        localProgress,
        currentTime,
        totalDuration
      });
      
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(position);
        controlsRef.current.target.copy(target);
      }
    }
  };

  // Add animation frame effect
  useEffect(() => {
    if (isPlaying && keyframes.length > 0) {
      console.log('Starting animation with state:', {
        keyframeCount: keyframes.length,
        totalDuration: keyframes.reduce((sum, kf) => sum + kf.duration, 0),
        currentProgress: progress
      });

      let animationStartTime = performance.now();
      let lastProgressUpdate = 0;
      
      const animate = () => {
        const currentTime = performance.now();
        const elapsedTime = (currentTime - animationStartTime) / 1000; // Convert to seconds
        const currentProgress = Math.min((elapsedTime / duration) * 100, 100);
        
        // Only update progress state when it changes by at least 1%
        if (Math.floor(currentProgress) > Math.floor(lastProgressUpdate)) {
          lastProgressUpdate = currentProgress;
          setProgress(currentProgress);
          onAnimationUpdate(currentProgress);
        }

        // Calculate camera position based on current progress
        const normalizedProgress = currentProgress / 100;
        const totalDuration = keyframes.reduce((sum, kf) => sum + kf.duration, 0);
        let animationTime = normalizedProgress * totalDuration;
        
        let currentKeyframeIndex = 0;
        let accumulatedDuration = 0;
        
        // Find current keyframe pair
        while (currentKeyframeIndex < keyframes.length - 1 && 
               accumulatedDuration + keyframes[currentKeyframeIndex].duration < animationTime) {
          accumulatedDuration += keyframes[currentKeyframeIndex].duration;
          currentKeyframeIndex++;
        }
        
        const k1 = keyframes[currentKeyframeIndex];
        const k2 = keyframes[Math.min(currentKeyframeIndex + 1, keyframes.length - 1)];
        
        const localProgress = (animationTime - accumulatedDuration) / k1.duration;

        // Log detailed interpolation state every 500ms
        if (Math.floor(currentTime / 500) > Math.floor(animationStartTime / 500)) {
          console.log('Animation interpolation:', {
            progress: currentProgress,
            keyframe: {
              current: currentKeyframeIndex,
              localProgress,
              time: animationTime
            }
          });
        }
        
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

        // Update camera position
        if (cameraRef.current && controlsRef.current) {
          cameraRef.current.position.copy(position);
          controlsRef.current.target.copy(target);
          controlsRef.current.update();
        }
        
        if (currentProgress < 100) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          console.log('Animation complete:', {
            finalPosition: position.toArray(),
            finalTarget: target.toArray()
          });
          animationFrameRef.current = undefined;
          onAnimationStop();
        }
      };
      
      // Cancel any existing animation frame before starting new one
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }
      };
    }
  }, [isPlaying, keyframes, duration]); // Removed progress from dependencies

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
      onAnimationStart();

      // Stop recording after duration + small buffer
      const recordingDuration = (duration * 1000) + 100;
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

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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

  const handleLockToggle = async () => {
    try {
      console.log('Lock toggle initiated. Current state:', {
        isLocked,
        hasModelRef: !!modelRef?.current,
        hasCameraRef: !!cameraRef?.current,
        hasControlsRef: !!controlsRef?.current
      });

      if (!isLocked && modelRef?.current && cameraRef?.current && controlsRef?.current) {
        console.log('Locking scene, storing metadata...');
        await storeEnvironmentalMetadata(
          modelRef.current,
          cameraRef.current,
          controlsRef.current
        );
        toast.success('Scene composition locked and saved');
      } else if (isLocked) {
        console.log('Unlocking scene...');
        toast.success('Scene unlocked');
      }
      
      console.log('Toggling lock state...');
      toggleLock();
      console.log('Lock state toggled. New state:', { isLocked: !isLocked });
    } catch (error) {
      console.error('Failed to store environmental metadata:', error);
      toast.error('Failed to store scene composition');
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (values: number[]) => {
    const value = values[0];
    const closestOption = SPEED_OPTIONS.reduce((prev, curr) => {
      return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
    });
    
    setPlaybackSpeed(closestOption.value);
    onPlaybackSpeedChange(closestOption.value);
  };

  // Handle scene clear
  const handleClearScene = () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      return;
    }

    // Reset all states
    setProgress(0);
    setKeyframes([]);
    setInstruction('');
    setGeneratePathState('initial');
    setTakeCount(0);
    setModelName(null);
    onAnimationStop();
    setIsConfirmingClear(false);

    // Reset camera to initial position
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(5, 5, 5);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }

    // Clear the model
    if (modelRef.current) {
      // Remove all children from the model
      while (modelRef.current.children.length > 0) {
        const child = modelRef.current.children[0];
        modelRef.current.remove(child);
        
        // Dispose of geometries and materials
        if (child instanceof Mesh) {
          if (child.geometry) {
            (child.geometry as BufferGeometry).dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((material: Material) => material.dispose());
            } else {
              (child.material as Material).dispose();
            }
          }
        }
      }
    }

    // Unlock the scene if it's locked
    if (isLocked) {
      toggleLock();
    }

    toast.success('Scene cleared');
  };

  // Add handler for creating a new shot
  const handleCreateNewShot = () => {
    // Reset only the states needed for a new shot
    setInstruction('');
    setGeneratePathState('initial');
    setIsConfirmingClear(false);
    
    // Unlock the scene if it's locked
    if (isLocked) {
      toggleLock();
    }

    toast.success('Ready for a new shot');
  };

  return (
    <ErrorBoundary name="CameraAnimationSystem" fallback={<CameraSystemFallback />}>
      <Card className="viewer-card border-[#444444]">
        <CardHeader className="viewer-panel-header">
          <CardTitle className="viewer-panel-title">Camera Path</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-6 space-y-4">
          <LockButton isLocked={isLocked} onToggle={handleLockToggle} />

          <div className="camera-path-fields space-y-4">
            <div className="space-y-4">
              <Textarea
                placeholder="Describe the camera movement you want..."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={!isLocked}
                className="min-h-[100px] resize-none"
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
                      onBlur={handleDurationBlur}
                      min={1}
                      max={20}
                      step={0.5}
                      className="text-right"
                      disabled={!isLocked || isGenerating}
                    />
                  </div>
                </div>
                <p className="text-xs text-[#444444] italic text-right">Max 20 sec</p>
              </div>

              <div className="mt-8">
                <motion.button
                  onClick={(e) => {
                    e.preventDefault();
                    handleGeneratePath();
                  }}
                  disabled={!isLocked || generatePathState === 'ready'}
                  className={cn(
                    buttonVariants({ variant: "primary", size: "lg" }),
                    "w-full",
                    isGenerating && "opacity-100 cursor-not-allowed",
                    generatePathState === 'ready' && 
                    "bg-[#1a1a1a] border border-[#444444] text-white hover:bg-[#1a1a1a] cursor-not-allowed"
                  )}
                  whileHover={isGenerating || generatePathState === 'ready' ? undefined : { scale: 1.02 }}
                  whileTap={isGenerating || generatePathState === 'ready' ? undefined : { scale: 0.98 }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={generatePathState === 'generating' ? messageIndex : generatePathState}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center gap-2 w-full"
                    >
                      {generatePathState === 'generating' 
                        ? <Loader2 className="h-6 w-6 animate-spin" />
                        : generatePathStates[generatePathState].icon
                      }
                      <span className="font-medium">
                        {generatePathState === 'generating' 
                          ? generatingMessages[messageIndex]
                          : generatePathStates[generatePathState].text
                        }
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* Status Message Pill */}
              <div className="mt-4 bg-[#2a2a2a] rounded-full px-4 py-2 text-sm text-center">
                {keyframes.length > 0 
                  ? `Take ${takeCount}: ${modelName || 'Untitled'}`
                  : "No shot available"
                }
              </div>

              {/* Playback Controls */}
              <div className="mt-6 space-y-6">
                <div className="flex justify-between gap-2">
                  <Button
                    onClick={handlePlayPause}
                    variant="secondary"
                    size="icon"
                    className={cn(
                      "flex-1 border border-[#444444] hover:bg-secondary/20",
                      keyframes.length > 0 && "bg-[#bef264] text-black hover:bg-[#bef264]/90"
                    )}
                    disabled={!keyframes.length || isGenerating}
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
                    disabled={!keyframes.length || isPlaying || isRecording}
                    className="flex-1 border border-[#444444] hover:bg-secondary/20"
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
                    <span className="text-sm text-muted-foreground">
                      {(duration / playbackSpeed).toFixed(1)}s
                    </span>
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
                      disabled={isPlaying || !keyframes.length || isRecording}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-7">
                      <span>0.25x</span>
                      <span>2.0x</span>
                    </div>
                  </div>
                </div>

                {/* Clear Scene Button */}
                <div className="flex justify-between mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCreateNewShot}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Create new shot
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearScene}
                    className={cn(
                      "text-muted-foreground hover:text-destructive",
                      isConfirmingClear && "text-destructive"
                    )}
                  >
                    {isConfirmingClear ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Confirm Clear
                      </>
                    ) : (
                      "Clear Scene"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}; 