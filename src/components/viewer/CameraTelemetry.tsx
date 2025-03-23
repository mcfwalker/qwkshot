'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Vector3, Euler, PerspectiveCamera } from 'three';
import { OrbitControls } from '@react-three/drei';

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
    <Card className="bg-background/80 backdrop-blur-sm">
      <CardContent className="p-4 space-y-2 text-xs font-mono">
        <div className="grid grid-cols-2 gap-x-4">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span>
                {formatNumber(telemetry.position.x)},
                {formatNumber(telemetry.position.y)},
                {formatNumber(telemetry.position.z)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rotation:</span>
              <span>
                {formatNumber(telemetry.rotation.x)},
                {formatNumber(telemetry.rotation.y)},
                {formatNumber(telemetry.rotation.z)}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distance:</span>
              <span>{formatNumber(telemetry.distance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">FOV:</span>
              <span>{formatNumber(telemetry.fov)}°</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 