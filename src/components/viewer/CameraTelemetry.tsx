'use client';

import { useEffect, useState } from 'react';
import { Vector3, Euler, PerspectiveCamera } from 'three';
import { OrbitControls } from '@react-three/drei';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CameraTelemetryProps {
  cameraRef: React.RefObject<PerspectiveCamera | null>;
  controlsRef: React.RefObject<any>;
}

interface TelemetryData {
  position: Vector3;
  rotation: Euler;
  distance: number;
  fov: number;
}

export default function CameraTelemetry({ cameraRef, controlsRef }: CameraTelemetryProps) {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    position: new Vector3(),
    rotation: new Euler(),
    distance: 0,
    fov: 0
  });
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    let frameId: number;

    const updateTelemetry = () => {
      if (cameraRef.current && controlsRef.current) {
        const camera = cameraRef.current;
        const controls = controlsRef.current;

        setTelemetry({
          position: camera.position.clone(),
          rotation: camera.rotation.clone(),
          distance: controls.getDistance(),
          fov: camera.fov
        });
      }
      frameId = requestAnimationFrame(updateTelemetry);
    };

    updateTelemetry();
    return () => cancelAnimationFrame(frameId);
  }, [cameraRef, controlsRef]);

  const formatNumber = (num: number) => num.toFixed(2);

  return (
    <div className="text-xs text-foreground/80 font-mono p-2 bg-black/20 backdrop-blur-sm rounded-md">
      <div className="flex justify-between items-center">
        <span className="font-semibold">Camera Info</span>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 hover:bg-white/10 rounded">
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col space-y-2 mt-1 pt-1 border-t border-gray-700/50">
          <div className="flex items-center">
            <span className="font-semibold mr-2 w-[60px] text-right">Position:</span>
            <span>
              {formatNumber(telemetry.position.x)},{formatNumber(telemetry.position.y)},{formatNumber(telemetry.position.z)}
            </span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold mr-2 w-[60px] text-right">Rotation:</span>
            <span>
              {formatNumber(telemetry.rotation.x)},{formatNumber(telemetry.rotation.y)},{formatNumber(telemetry.rotation.z)}
            </span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold mr-2 w-[60px] text-right">Distance:</span>
            <span>{formatNumber(telemetry.distance)}</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold mr-2 w-[60px] text-right">FOV:</span>
            <span>{formatNumber(telemetry.fov)}°</span>
          </div>
        </div>
      )}
    </div>
  );
} 