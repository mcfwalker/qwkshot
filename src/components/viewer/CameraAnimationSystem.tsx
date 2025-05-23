'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { CameraCommand } from '@/types/p2p/scene-interpreter';
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { updateEnvironmentalMetadataAction } from '@/app/actions/models';
import { SerializedVector3 } from '@/types/p2p/shared';
import { supabase } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TabsTrigger } from '../ui/tabs';

// Import the extracted components
import { ShotCallerPanel } from './ShotCallerPanel'; 
import { PlaybackPanel } from './PlaybackPanel';

// Import the actual easing functions map
// We need access to the functions themselves on the client-side
// TODO: Define this map in a shared utility file?
const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

// Import the name type if needed for casting/checking
import { EasingFunctionName } from '@/lib/easing';

// Define the props interface
interface CameraAnimationSystemProps {
  isPlaying: boolean;
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  progress: number;
  duration: number;
  playbackSpeed: number;
  fov: number;
  userVerticalAdjustment: number;
  onPlayPause: () => void;
  onStop: () => void;
  onProgressChange: (progress: number) => void;
  onSpeedChange: (speed: number) => void;
  onDurationChange: (duration: number) => void;
  onGeneratePath: (commands: CameraCommand[], duration: number) => void;
  modelRef: React.RefObject<Object3D | null>;
  cameraRef: React.RefObject<PerspectiveCamera>;
  controlsRef: React.RefObject<any>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  disabled?: boolean;
  isModelLoaded: boolean;
  resetCounter: number;
  modelId: string | null;
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

// Fun, cinematic-themed messages for the generating state - shortened
const generatingMessages = [
  "Setting up shot...",
  "Calculating angles...",
  "Choreographing moves...",
  "Finding moments...",
  "Making it epic...",
  "Adding magic...",
  "Crafting sequence...",
  "Directing scene..."
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

// Define Tab values
type TabValue = 'shotCaller' | 'playback';

// Helper to serialize Vector3 for sending to server action
function serializeVector3(v: Vector3): SerializedVector3 {
  return { x: v.x || 0, y: v.y || 0, z: v.z || 0 };
}

// UUID Regex for validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CameraAnimationSystem: React.FC<CameraAnimationSystemProps> = ({
  isPlaying,
  isRecording,
  setIsRecording,
  progress,
  duration,
  playbackSpeed,
  fov,
  userVerticalAdjustment,
  onPlayPause,
  onStop,
  onProgressChange,
  onSpeedChange,
  onDurationChange,
  onGeneratePath,
  modelRef,
  cameraRef,
  controlsRef,
  canvasRef,
  disabled,
  isModelLoaded,
  resetCounter,
  modelId,
}) => {
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [commands, setCommands] = useState<CameraCommand[]>([]);
  const [inputDuration, setInputDuration] = useState(duration.toString());
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [generatePathState, setGeneratePathState] = useState<GeneratePathState>('initial');
  const animationFrameRef = useRef<number | undefined>(undefined);
  const { isLocked, toggleLock } = useViewerStore();
  const [messageIndex, setMessageIndex] = useState(0);
  const [takeCount, setTakeCount] = useState(0);
  const [modelName, setModelName] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('shotCaller');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  // >>> Add Ref for audio element <<<
  const chimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const lockAudioRef = useRef<HTMLAudioElement | null>(null);

  // Add a new ref for Web Audio context
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize audio elements with improved handling
  useEffect(() => {
    // Create and preload the chime audio element
    if (!chimeAudioRef.current) {
      const chimeAudio = new Audio();
      chimeAudio.addEventListener('error', (e) => {
        console.error('Error loading chime audio:', e);
      });
      chimeAudio.src = '/sounds/download_success_chime.mp3';
      chimeAudio.preload = 'auto';
      chimeAudio.volume = 1.0;
      chimeAudioRef.current = chimeAudio;
      chimeAudio.load();
    }
    
    // Create and preload the lock audio element
    if (!lockAudioRef.current) {
      const lockAudio = new Audio();
      lockAudio.addEventListener('error', (e) => {
        console.error('Error loading lock audio:', e);
      });
      lockAudio.src = '/sounds/lock_screen.mp3';
      lockAudio.preload = 'auto';
      lockAudio.volume = 1.0;
      lockAudioRef.current = lockAudio;
      lockAudio.load();
    }
    
    return () => {
      if (chimeAudioRef.current) {
        chimeAudioRef.current.pause();
        chimeAudioRef.current = null;
      }
      if (lockAudioRef.current) {
        lockAudioRef.current.pause();
        lockAudioRef.current = null;
      }
    };
  }, []);

  // Initialize Web Audio API as an additional fallback
  useEffect(() => {
    // Only initialize if Web Audio API is supported
    if (window.AudioContext || (window as any).webkitAudioContext) {
      try {
        // Create audio context
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        
        // Load chime sound file as ArrayBuffer
        fetch('/sounds/download_success_chime.mp3')
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.arrayBuffer();
          })
          .then(arrayBuffer => {
            if (audioContextRef.current) {
              return audioContextRef.current.decodeAudioData(arrayBuffer);
            }
            throw new Error('Audio context not available');
          })
          .then(audioBuffer => {
            audioBufferRef.current = audioBuffer;
          })
          .catch(error => {
            console.error('Error setting up Web Audio API:', error);
          });
      } catch (error) {
        console.error('Failed to initialize Web Audio API:', error);
      }
    }
    
    // Cleanup
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error('Error closing audio context:', err);
        });
        audioContextRef.current = null;
      }
      audioBufferRef.current = null;
    };
  }, []);

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

  // Effect to reset local state when resetCounter changes
  useEffect(() => {
    if (resetCounter > 0) { // Only run after initial mount
      console.log("CameraAnimationSystem: Resetting local state due to trigger");
      setInstruction('');
      setCommands([]); // Also clear local commands if used for anything
      setGeneratePathState('initial');
      setTakeCount(0);
      setActiveTab('shotCaller');
      // Reset other local state related to generation/playback if needed
    }
  }, [resetCounter]);

  // Effect to update inputDuration when duration prop changes externally
  useEffect(() => {
    if (duration !== parseFloat(inputDuration)) {
      setInputDuration(duration.toString());
    }
  }, [duration, inputDuration]);

  const handleGeneratePath = async (isRetry: boolean = false) => {
    console.log('[CameraAnimationSystem] handleGeneratePath called. isRetry:', isRetry);
    console.log('[CameraAnimationSystem] modelId from props:', modelId); // Log the modelId prop

    if (!isModelLoaded || !modelRef.current || !cameraRef.current || !controlsRef.current) {
      toast.error("Model not loaded or refs not available.");
      return;
    }

    if (!instruction.trim()) {
      toast.error('Please describe the camera movement you want');
      return;
    }

    setIsGenerating(true);
    setGeneratePathState('generating');
    setMessageIndex(0); // Reset message index
    
    try {
      // ADDED: Validate the modelId prop
      if (!modelId || !uuidRegex.test(modelId)) {
        console.error('[CameraAnimationSystem] Invalid modelId prop for animation generation:', modelId);
        toast.error('Cannot generate animation: Invalid model identifier.');
        setIsGenerating(false);
        setGeneratePathState('initial');
        return;
      }

      // Fetch model name from Supabase - modelId here now refers to the prop
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
      const payload: any = {
          instruction,
          duration: parseFloat(inputDuration),
          modelId // This now correctly refers to the modelId prop
      };

      // If it's a retry, add context
      if (isRetry) {
          payload.retryContext = { reason: 'bounding_box_violation' };
          toast.info('Attempting to generate path again with feedback...');
      }

      const pathResponse = await fetch('/api/camera-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // Use the constructed payload
      });

      if (!pathResponse.ok) {
        // --- MODIFIED ERROR HANDLING --- START
        const errorResponse = await pathResponse.json();
        console.error('API Error Response:', errorResponse);

        // Check for specific bounding box violation code
        if (pathResponse.status === 422 && errorResponse?.code === 'PATH_VIOLATION_BOUNDING_BOX') {
            // Handle specific error: Show retry option
            toast.error('Generated path needs another try!', {
                description: 'The camera path might have entered the object. Would you like to generate it again?',
                action: {
                    label: 'Try Again',
                    onClick: () => handleGeneratePath(true) // Pass flag to indicate retry
                },
            });
            // Reset state without throwing a blocking error
            setGeneratePathState('initial'); 
            setCommands([]);
            setIsGenerating(false); // Ensure loading state stops
            return; // Stop further processing for this attempt
        } else {
            // Throw generic error for other failures
            throw new Error(errorResponse.error || `API Error: ${pathResponse.status} ${pathResponse.statusText}`);
        }
        // --- MODIFIED ERROR HANDLING --- END
      }

      // Process the response - expecting CameraCommand[]
      const receivedCommands: any[] = await pathResponse.json(); 
      
      // Validate and parse commands
      if (!Array.isArray(receivedCommands)) {
        throw new Error('Invalid command data received from API');
      }
      
      if (receivedCommands.length === 0) {
        // Handle empty path case - maybe show a specific message?
        toast.info('Generated path has no commands.');
        setCommands([]); // Set empty commands
        setGeneratePathState('initial'); // Reset state?
        // Maybe don't automatically start animation?
        // onAnimationStop(); 
        return; // Stop further processing
      }
      
      // Parse commands and convert to Vector3 instances
      const newCommands: CameraCommand[] = receivedCommands.map((cmd, index) => {
        try {
          // --- MODIFIED VALIDATION ---
          // Ensure position/target exist and are objects (even if empty initially)
          if (!cmd || typeof cmd !== 'object' || 
              !cmd.position || typeof cmd.position !== 'object' || 
              !cmd.target || typeof cmd.target !== 'object' || 
              typeof cmd.duration !== 'number' || cmd.duration < 0) { // Allow duration 0, reject negative
              throw new Error(`Command ${index} missing required fields, is not an object, or has invalid duration.`);
          }
          // --- END MODIFIED VALIDATION ---
          
          // --- ADDED: Reconstruct Vector3 --- 
          // Check if position/target have x, y, z before creating Vector3
          if (typeof cmd.position.x !== 'number' || typeof cmd.position.y !== 'number' || typeof cmd.position.z !== 'number' ||
              typeof cmd.target.x !== 'number' || typeof cmd.target.y !== 'number' || typeof cmd.target.z !== 'number') {
             throw new Error(`Command ${index} position or target object is missing x, y, or z properties.`); 
          }
          const positionVec = new Vector3(cmd.position.x, cmd.position.y, cmd.position.z);
          const targetVec = new Vector3(cmd.target.x, cmd.target.y, cmd.target.z);
          // --- END ADDED ---

          const command: CameraCommand = {
            position: positionVec, // Use reconstructed Vector3
            target: targetVec,     // Use reconstructed Vector3
            duration: cmd.duration,
            easing: cmd.easing || 'linear' // Use easing from command or default to linear
          };
          return command;
        } catch (err) {
          console.error(`Error parsing command ${index}:`, cmd, err);
          // Handle unknown error type
          const errorMsg = err instanceof Error ? err.message : 'Unknown error during command parsing';
          throw new Error(`Error processing command ${index}: ${errorMsg}`); // Re-throw to stop processing
        }
      });

      // Set the new commands state
      setCommands(newCommands);

      // Calculate total duration from commands
      const totalDuration = newCommands.reduce((sum, cmd) => sum + cmd.duration, 0);
      onDurationChange(totalDuration);
      setInputDuration(totalDuration.toFixed(1)); // Update input field too
      onProgressChange(0); // Use callback to reset parent state
      setGeneratePathState('ready');
      
      onGeneratePath(newCommands, totalDuration);
      toast.success('Camera path generated successfully');
      
      console.log('🔍 Camera path generation successful, commands:', newCommands.length);
      
      // Switch to playback tab on success
      setActiveTab('playback'); 

      // >>> Play chime sound with improved error handling <<<
      if (chimeAudioRef.current) {
        try {
          // Reset the audio to the beginning in case it was played before
          chimeAudioRef.current.currentTime = 0;
          
          // Play the audio with better error handling
          const playPromise = chimeAudioRef.current.play();
          
          // Modern browsers return a promise from play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // Sound played successfully
              })
              .catch(error => {
                console.warn("Could not play chime sound:", error);
                
                // Use Web Audio API as fallback
                if (audioContextRef.current && audioBufferRef.current) {
                  try {
                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBufferRef.current;
                    source.connect(audioContextRef.current.destination);
                    source.start(0);
                  } catch (e) {
                    console.error("Web Audio fallback failed:", e);
                  }
                }
                
                // Setup click listener as last resort
                const userGesture = () => {
                  if (chimeAudioRef.current) {
                    chimeAudioRef.current.play()
                      .then(() => {
                        document.removeEventListener('click', userGesture);
                      })
                      .catch(() => {
                        // Final fallback failed
                      });
                  }
                };
                
                // Listen for any click to try playing sound again
                document.addEventListener('click', userGesture, { once: true });
        });
          }
        } catch (error) {
          console.error("Error playing chime:", error);
        }
      }

      // Reset button state *after* switching tab
      setGeneratePathState('initial'); 

    } catch (error) {
      console.error('Error generating camera path:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate camera path');
      setGeneratePathState('initial');
      setCommands([]); // Clear commands on error
    } finally {
      setIsGenerating(false);
    }
  };

  // Add a new function for playing notification sound with simplified approach
  const playNotificationSound = () => {
    console.log('🔔 Attempting to play notification sound (simplified approach)');
    
    try {
      // Use the AudioContext API directly - this approach is often more reliable
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        console.warn('🔔 AudioContext not supported in this browser');
        return;
      }
      
      // Create a short beep using the Web Audio API
      // This is more likely to work than loading an external file
      const audioContext = new AudioContextClass();
      
      // Resume context (needed for autoplay policy)
      audioContext.resume().then(() => {
        // Create an oscillator (sound generator)
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine'; // Sine wave = smooth sound
        oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime); // E6 note
        
        // Create gain node to control volume
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Start at 10% volume
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); // Fade out
        
        // Connect nodes: oscillator -> gain -> output
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Play sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5); // Play for 0.5 seconds
        
        console.log('🔔 Notification beep playing');
        
        // Clean up
        setTimeout(() => {
          audioContext.close();
        }, 1000);
      }).catch(err => {
        console.warn('🔔 Failed to resume audio context:', err);
      });
    } catch (e) {
      console.error('🔔 Error playing notification beep:', e);
    }
  };
  
  // Also try to load the mp3 file as an alternative
  const playChimeSound = () => {
    console.log('🔔 Attempting to play chime sound (mp3 file)');
    
    try {
      // Try to create and play a new audio element
      const audio = new Audio('/sounds/download_success_chime.mp3');
      audio.volume = 1.0;
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log('🔔 Chime sound played successfully'))
          .catch(e => {
            console.warn('🔔 Could not play chime sound:', e);
            // Fall back to the beep if mp3 fails
            playNotificationSound();
          });
      }
    } catch (e) {
      console.error('🔔 Error attempting to play chime:', e);
      // Fall back to the beep if mp3 fails
      playNotificationSound();
    }
  };

  const handleAnimationStart = () => {
    console.log('Animation starting...', {
      keyframesCount: commands.length,
      totalDuration: commands.reduce((sum, kf) => sum + kf.duration, 0),
      hasCamera: !!cameraRef.current,
      hasControls: !!controlsRef.current
    });
    onPlayPause();
  };

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
      mediaRecorderRef.current = mediaRecorder; // Store ref
      chunksRef.current = []; // Resetting chunks

      // Add error handler
      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred. See console for details.');
        setIsRecording(false); // Ensure loading state stops on error
      };

      // Collect data chunks during recording
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording completion
      mediaRecorder.onstop = () => {
        console.log('>>> MediaRecorder.onstop triggered'); // Log start of handler
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
          
          // --- Dynamic Filename Generation ---
          const now = new Date();
          const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
          // Replace spaces with dashes, remove unsafe chars
          const safeModelName = (modelName || 'Model').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-]/g, ''); 
          const takeNumber = takeCount > 0 ? takeCount : 1; // Ensure take is at least 1 if generation happened
          const filename = `${safeModelName}-Take${takeNumber}-${timestamp}.webm`;
          console.log("Generated Filename:", filename);
          // --- End Dynamic Filename ---
          
          a.download = filename; // Use dynamic filename
          a.click();
          URL.revokeObjectURL(url);
        } else {
          toast.error('Generated video file was empty');
        }
        
        setIsRecording(false);
        console.log('>>> MediaRecorder.onstop finished'); // Log end of handler
      };

      // Start recording
      setIsRecording(true);
      mediaRecorder.start(50); // Request data every 50ms

      // Start the animation
      onPlayPause();

      // Stop recording after duration + small buffer, adjusted for playback speed
      const recordingDuration = (duration / playbackSpeed * 1000) + 100;
      setTimeout(() => {
        console.log('>>> setTimeout: Attempting to stop recording...', { state: mediaRecorderRef.current?.state }); // Log before stop
        if (mediaRecorderRef.current?.state === 'recording') { // Check ref before stopping
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
      onStop();
    } else {
      onPlayPause();
    }
  };

  const handleReset = () => {
    onProgressChange(0); // Inform parent to reset progress
    onStop();
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputDuration(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
      onDurationChange(numValue);
    }
  };

  const handleDurationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const numValue = parseFloat(inputDuration);
    if (isNaN(numValue) || numValue < 1) {
      setInputDuration('1');
      onDurationChange(1);
    } else if (numValue > 20) {
      setInputDuration('20');
      onDurationChange(20);
    } else {
      setInputDuration(numValue.toString());
      onDurationChange(numValue);
    }
  };

  const handleLockToggle = async () => {
    console.log(`>>> handleLockToggle called with modelId prop: ${modelId}`); 
    const currentModelId = modelId; 
    console.log('Lock toggle initiated. Current state:', { isLocked, currentModelId });

    if (!currentModelId || !uuidRegex.test(currentModelId)) {
        toast.error('Cannot lock scene: No valid model loaded.', { description: 'Please select or upload a model first.'});
        return;
    }
    
    try {
      // Toggle the lock state in the store first
      // toggleLock(); 
      const willBeLocked = !isLocked; // Check the *intended* state based on current value

      // Play lock/unlock sound
      if (lockAudioRef.current) {
        try {
          // Reset the audio to the beginning in case it was played before
          lockAudioRef.current.currentTime = 0;
          
          // Play the audio
          const playPromise = lockAudioRef.current.play();
          
          // Modern browsers return a promise from play()
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn("Could not play lock sound:", error);
            });
          }
        } catch (error) {
          console.error("Error playing lock sound:", error);
        }
      }

      if (willBeLocked) {
        console.log('>>> Locking scene. Saving Environmental Metadata...');

        try {
          // Re-check required refs just before using them
          if (!modelRef.current || !cameraRef.current || !controlsRef.current) {
            throw new Error("Refs became unavailable before metadata construction.");
          }
          
          // Construct the metadata object 
          const metadataToSave: EnvironmentalMetadata = {
            camera: {
              position: serializeVector3(cameraRef.current.position),
              target: serializeVector3(controlsRef.current.target),
              fov: fov,
            },
            // Store ONLY the userVerticalAdjustment. 
            // RENAME the field for clarity (ensure backend/types match later)
            userVerticalAdjustment: userVerticalAdjustment, // <- Use prop directly & rename field
          };

          console.log('handleLockToggle: Metadata to save:', metadataToSave);

          // Call the server action
          const result = await updateEnvironmentalMetadataAction({
            modelId: currentModelId, 
            metadata: metadataToSave,
          });

          // 4. Handle result
          if (result.success) {
              toast.success('Scene composition locked and saved');
          } else {
              throw new Error(result.error || 'Failed to save scene composition via server action.');
          }
          
        } catch (error) {
          console.error('Failed to store/update environmental metadata:', error);
          toast.error('Failed to save scene composition', { description: error instanceof Error ? error.message : undefined });
        }
      } else if (isLocked) {
        console.log('Unlocking scene...');
        toast.success('Scene unlocked'); // Change from info to success for consistency
      }
      
      // Toggle lock state AFTER potential async operations succeed
      console.log('Toggling lock state in store...');
      toggleLock(); 
      console.log('Lock state toggle processed.');

    } catch (error) {
      console.error('Failed to store/update environmental metadata:', error);
      toast.error('Failed to save scene composition', { description: error instanceof Error ? error.message : undefined });
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (values: number[]) => {
    const value = values[0];
    const closestOption = SPEED_OPTIONS.reduce((prev, curr) => {
      return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
    });
    
    onSpeedChange(closestOption.value);
  };

  // Handle scene clear
  const handleClearScene = () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      return;
    }

    // Reset all states
    onProgressChange(0); // Inform parent to reset progress
    setCommands([]);
    setInstruction('');
    setGeneratePathState('initial');
    setTakeCount(0);
    setModelName(null);
    onStop();
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
    // Reset relevant state, but keep the instruction
    // setInstruction(''); // Keep the previous instruction
    setCommands([]);
    onProgressChange(0); // Use callback to reset parent progress
    setGeneratePathState('initial');
    // Unlock if currently locked
    if (isLocked) {
      toggleLock();
    }
    setActiveTab('shotCaller'); // Switch back to shot caller tab
    toast.info('Ready for new shot');
  };

  return (
    // NEW WRAPPING DIV for the main panel structure
    <div className="w-[288px] bg-[#1D1D1D] rounded-xl p-4 flex flex-col gap-6">
      <ErrorBoundary name="CameraAnimationSystem" fallback={<CameraSystemFallback />}>
        <TabsPrimitive.Root 
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabValue)}
            className="flex flex-col flex-1 min-h-0 gap-6"
        >
          <TabsPrimitive.List className="flex items-center justify-center h-[40px] w-full gap-4">
            <TabsTrigger
              value="shotCaller"
              className="TEST_CURSOR_TARGET cursor-pointer"
            >
              SHOT CALLER
            </TabsTrigger>
            <TabsTrigger
              value="playback"
              className="TEST_CURSOR_TARGET cursor-pointer"
            >
              PLAYBACK
            </TabsTrigger>
          </TabsPrimitive.List>

          <div className="flex flex-col flex-1 min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  className="h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'shotCaller' && (
                    <ShotCallerPanel 
                      isLocked={isLocked}
                      isGenerating={isGenerating}
                      generatePathState={generatePathState}
                      instruction={instruction}
                      inputDuration={inputDuration}
                      generatingMessage={generatingMessages[messageIndex]}
                      messageIndex={messageIndex}
                      onLockToggle={handleLockToggle}
                      onInstructionChange={setInstruction}
                      onDurationChange={handleDurationChange}
                      onDurationBlur={handleDurationBlur}
                      onGeneratePath={handleGeneratePath}
                      isModelLoaded={isModelLoaded}
                    />
                  )}
                  {activeTab === 'playback' && (
                    <PlaybackPanel 
                      commands={commands}
                      isPlaying={isPlaying}
                      isRecording={isRecording}
                      playbackSpeed={playbackSpeed}
                      duration={duration}
                      takeCount={takeCount}
                      modelName={modelName}
                      isGenerating={isGenerating}
                      progress={progress}
                      onPlayPause={handlePlayPause}
                      onDownload={handleDownload}
                      onSpeedChange={handleSpeedChange}
                      onCreateNewShot={handleCreateNewShot}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
          </div>

        </TabsPrimitive.Root>
        {/* Audio element is now created programmatically */}
      </ErrorBoundary>
    </div>
  );
}; 