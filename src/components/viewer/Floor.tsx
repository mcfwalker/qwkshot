'use client';

import { useEffect, useRef, useState } from 'react';
import { useTexture } from '@react-three/drei';
import { DoubleSide, TextureLoader, RepeatWrapping, Texture, MeshStandardMaterial } from 'three';
import { supabase } from '@/lib/supabase';

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
  console.log('Floor component props:', { type, texture }); // Log received props

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
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const materialRef = useRef<MeshStandardMaterial>(null!);
  
  // Process the URL first to handle Supabase URLs correctly
  useEffect(() => {
    // Check if it's a Supabase URL - if so, we'll need to handle it differently
    const handleTextureUrl = async () => {
      try {
        // If it's a standard URL (not Supabase storage URL) just use it directly
        if (!url.includes('supabase.co/storage')) {
          setProcessedUrl(url);
          return;
        }
        
        // For Supabase URLs, extract the path and use the getPublicUrl method
        // This ensures proper URL formatting and caching headers
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/([^?]+)/);
        
        if (pathMatch && pathMatch[1]) {
          const path = decodeURIComponent(pathMatch[1]);
          const bucketName = path.split('/')[0];
          const objectPath = path.split('/').slice(1).join('/');
          
          // Get a public URL that avoids the 406 error
          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(objectPath);
            
          if (data?.publicUrl) {
            // Add cache busting to prevent stale textures
            const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
            console.log('Using processed public URL:', publicUrl);
            setProcessedUrl(publicUrl);
          } else {
            console.error('Failed to get public URL for texture');
            setProcessedUrl(url); // Fallback to original URL
          }
        } else {
          // If we can't parse the URL, just use the original
          setProcessedUrl(url);
        }
      } catch (error) {
        console.error('Error processing texture URL:', error);
        setProcessedUrl(url); // Fallback to original URL
      }
    };
    
    handleTextureUrl();
  }, [url]);
  
  // Don't try to load the texture until we have the processed URL
  if (!processedUrl) {
    return null;
  }
  
  // Now use the processed URL with useTexture
  const texture = useTexture(processedUrl);
  
  // Configure texture for tiling using useEffect
  useEffect(() => {
    if (texture) {
      console.log("TexturedFloor Effect: Applying texture settings");
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(10, 10); // Repeat the texture 10 times
      texture.needsUpdate = true; // Signal texture properties changed
    }
  }, [texture]); // Run effect when texture object changes

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.01, 0]} 
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        ref={materialRef} // Assign ref to material
        map={texture}
        color="#ffffff" 
        side={DoubleSide}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
} 