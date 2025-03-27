'use client';

import { useEffect, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import { DoubleSide, TextureLoader, RepeatWrapping, Texture, MeshStandardMaterial } from 'three';

export type FloorType = 'grid' | 'none';

interface FloorProps {
  type: FloorType;
  texture?: string | null; // URL to texture
  size?: number;
  divisions?: number;
  color?: string;
}

export default function Floor({
  type = 'grid',
  texture = null,
  size = 20,
  divisions = 20,
  color = '#444444'
}: FloorProps) {
  // Don't render anything if type is 'none' and no texture
  if (type === 'none' && !texture) return null;

  // If we have a texture, render the textured floor
  if (texture) {
    return <TexturedFloor url={texture} size={size} />;
  }

  // Default to grid if no texture and type is grid
  if (type === 'grid') {
    return (
      <gridHelper
        args={[size, divisions, color, color]}
        rotation={[0, 0, 0]}
        position={[0, -0.01, 0]} // Slightly below 0 to avoid z-fighting
      />
    );
  }

  return null;
}

function TexturedFloor({ url, size = 20 }: { url: string; size?: number }) {
  // Load the texture using React Three Fiber's useTexture hook
  const texture = useTexture(url);
  
  // Configure texture for tiling
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(10, 10); // Repeat the texture 10 times
  }

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.01, 0]} 
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        map={texture}
        color="#ffffff" 
        side={DoubleSide}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
} 