'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Suspense, useRef, useState, useCallback } from 'react';
import { Vector3, PerspectiveCamera as ThreePerspectiveCamera, Object3D, MOUSE } from 'three';
// Commented out unused imports (keeping for reference)
// import CameraControls from './CameraControls';
// import FloorControls from './FloorControls';
import CameraTelemetry from './CameraTelemetry';
import { CameraAnimationSystem } from './CameraAnimationSystem';
import Floor, { FloorType } from './Floor';
import { SceneControls } from './SceneControls';
import { PlaybackPanel } from './PlaybackPanel';
import { toast } from 'sonner';

// Model component that handles GLTF/GLB loading
function Model({ url, modelRef, height = 0 }: { url: string; modelRef: React.RefObject<Object3D | null>; height?: number }) {
  const { scene } = useGLTF(url);
  
  // Update the ref when the scene changes
  if (modelRef.current !== scene) {
    modelRef.current = scene;
  }
  
  // Apply height offset
  scene.position.y = height;
  
  return <primitive object={scene} />;
}

interface ViewerProps {
  className?: string;
  modelUrl: string;
}

export default function Viewer({ className, modelUrl }: ViewerProps) {
  const [fov, setFov] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(5);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [modelHeight, setModelHeight] = useState(0);
  const [floorType, setFloorType] = useState<FloorType>('grid');
  const [floorTexture, setFloorTexture] = useState<string | null>(null);
  
  const modelRef = useRef<Object3D | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null!);
  const controlsRef = useRef<any>(null);
  const startPositionRef = useRef<Vector3 | null>(null);
  const startTargetRef = useRef<Vector3 | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  const handleCameraUpdate = useCallback((position: Vector3, target: Vector3) => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(position);
      controlsRef.current.target.copy(target);
    }
  }, []);

  const handleAnimationUpdate = useCallback((progress: number) => {
    if (!cameraRef.current || !controlsRef.current || !startPositionRef.current || !startTargetRef.current) {
      return;
    }

    // Calculate orbit position with playback speed adjustment
    const adjustedProgress = progress * playbackSpeed;
    const angle = adjustedProgress * Math.PI * 2; // Full circle
    const radius = 5; // Distance from center
    const height = 2; // Height above ground

    const newPosition = new Vector3(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );

    // Keep looking at the center
    const target = new Vector3(0, 0, 0);

    // Update camera and controls
    cameraRef.current.position.copy(newPosition);
    controlsRef.current.target.copy(target);
  }, [playbackSpeed]);

  const handleAnimationStart = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      // Store starting position and target
      startPositionRef.current = cameraRef.current.position.clone();
      startTargetRef.current = controlsRef.current.target.clone();
      setIsPlaying(true);
    }
  }, []);

  const handleAnimationStop = useCallback(() => {
    setIsPlaying(false);
    // Reset to starting position if needed
    if (startPositionRef.current && startTargetRef.current && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(startPositionRef.current);
      controlsRef.current.target.copy(startTargetRef.current);
    }
  }, []);

  const handleAnimationPause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <div className={`w-full h-full relative ${className}`}>
      <Canvas
        ref={canvasRef}
        camera={{ position: [5, 5, 5], fov }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            position={[0, 2, 5]}
            fov={fov}
          />
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={10}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={0}
            target={[0, 0, 0]}
            makeDefault
            listenToKeyEvents={window}
            domElement={canvasRef.current}
            enableZoom={true}
            mouseButtons={{
              LEFT: MOUSE.ROTATE,
              MIDDLE: MOUSE.DOLLY,
              RIGHT: MOUSE.PAN
            }}
          />
          
          {/* Ambient light for overall scene illumination */}
          <ambientLight intensity={0.5} />
          
          {/* Directional light for shadows and highlights */}
          <directionalLight
            position={[5, 5, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          
          {/* Add the floor */}
          <Floor 
            type={floorType} 
            texture={floorTexture} 
            size={20} 
            divisions={20} 
          />
          
          {/* Display either the loaded model or a placeholder cube */}
          {modelUrl ? (
            <Model url={modelUrl} modelRef={modelRef} height={modelHeight} />
          ) : (
            <mesh castShadow receiveShadow ref={modelRef} position={[0, modelHeight, 0]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="white" />
            </mesh>
          )}
          
          {/* Environment for realistic lighting */}
          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {/* Scene Controls panel - positioned below Cast container */}
      <div className="absolute left-4 top-[calc(4rem+20rem+1rem)] w-80 z-10">
        <SceneControls
          modelHeight={modelHeight}
          onModelHeightChange={setModelHeight}
          fov={fov}
          onFovChange={setFov}
          floorType={floorType}
          onFloorTypeChange={setFloorType}
          onFloorTextureChange={setFloorTexture}
        />
      </div>

      {/* Camera Animation System - positioned in upper right */}
      <div className="absolute right-4 top-4 w-80 z-10">
        <CameraAnimationSystem
          onAnimationUpdate={handleAnimationUpdate}
          onAnimationStop={handleAnimationStop}
          onAnimationStart={handleAnimationStart}
          onAnimationPause={handleAnimationPause}
          isPlaying={isPlaying}
          duration={duration}
          setDuration={setDuration}
          modelRef={modelRef}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          canvasRef={canvasRef}
        />
      </div>

      {/* Playback panel - positioned below Camera Animation System */}
      <div className="absolute right-4 top-[calc(4rem+24rem+1rem)] w-80 z-10">
        <PlaybackPanel
          isPlaying={isPlaying}
          duration={duration}
          onPlaybackSpeedChange={setPlaybackSpeed}
          onPlayPause={isPlaying ? handleAnimationPause : handleAnimationStart}
          disabled={!modelRef.current}
          canvasRef={canvasRef}
        />
      </div>

      {/* Camera telemetry display */}
      <div className="absolute right-4 bottom-4 w-80 z-10">
        <CameraTelemetry
          cameraRef={cameraRef}
          controlsRef={controlsRef}
        />
      </div>
    </div>
  );
} 