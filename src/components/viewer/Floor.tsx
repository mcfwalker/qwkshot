'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useTexture, Grid as DreiGrid, Plane } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { DoubleSide, RepeatWrapping, MeshStandardMaterial, LinearFilter, Color } from 'three';
import { supabase } from '@/lib/supabase';

export type FloorType = 'grid' | 'textured' | 'none';

interface FloorProps {
  type: FloorType;
  texture?: string | null; // URL to texture
  gridMainColor?: string;
  gridFadeDistance?: number;
  gridFadeStrength?: number;
  gridInfinite?: boolean;
  gridFollowCamera?: boolean;
  gridCellSize?: number;
  gridSectionSize?: number;
  gridSectionThickness?: number;
  gridCellThickness?: number;
}

export default function Floor({
  type = 'grid',
  texture = null,
  gridMainColor = '#444444',
  gridFadeDistance = 25,
  gridFadeStrength = 3.5,
  gridInfinite = true,
  gridFollowCamera = true,
  gridCellSize = 0.5,
  gridSectionSize = 2.5,
  gridSectionThickness = 1.5,
  gridCellThickness = 1,
}: FloorProps) {
  console.log('Floor component props:', { type, texture, gridMainColor });

  // Don't render anything if type is 'none' and no texture
  if (type === 'none' && !texture) return null;

  // If we have a texture, render the textured floor with fallback to grid
  if (texture) {
    return (
      <Suspense fallback={
        <DreiGrid
          position={[0, -0.01, 0]}
          args={[undefined, undefined]}
          cellSize={gridCellSize}
          sectionSize={gridSectionSize}
          cellColor={gridMainColor}
          sectionColor={gridMainColor}
          cellThickness={gridCellThickness}
          sectionThickness={gridSectionThickness}
          fadeDistance={gridFadeDistance}
          fadeStrength={gridFadeStrength}
          infiniteGrid={gridInfinite}
          followCamera={gridFollowCamera}
        />
      }>
        <TexturedFloor url={texture} size={100} fallbackColor={gridMainColor} />
      </Suspense>
    );
  }

  // Default to grid if no texture and type is grid
  if (type === 'grid') {
    return (
      <DreiGrid
        position={[0, -0.01, 0]}
        cellSize={gridCellSize}
        sectionSize={gridSectionSize}
        cellColor={gridMainColor}
        sectionColor={gridMainColor}
        cellThickness={gridCellThickness}
        sectionThickness={gridSectionThickness}
        fadeDistance={gridFadeDistance}
        fadeStrength={gridFadeStrength}
        infiniteGrid={gridInfinite}
        followCamera={gridFollowCamera}
      />
    );
  }

  return null;
}

// Wrapper component that handles URL processing
function TexturedFloor({ url, size = 100, fallbackColor = '#444444' }: { url: string; size?: number; fallbackColor?: string }) {
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  
  // Process the URL first to handle Supabase URLs correctly
  useEffect(() => {
    // Check if it's a Supabase URL - if so, we'll need to handle it differently
    const handleTextureUrl = async () => {
      try {
        // If it's a standard URL (not Supabase storage URL) just use it directly
        if (!url.includes('supabase.co/storage')) {
          console.log('Using direct URL:', url);
          setProcessedUrl(url);
          return;
        }
        
        console.log('Processing Supabase URL:', url);
        
        // Parse the URL to extract the bucket and path
        // Example: https://xxx.supabase.co/storage/v1/object/sign/floor-textures/image.jpg
        const urlObj = new URL(url);
        
        // Extract the path pattern, handling both "sign", "public", etc.
        const pathRegex = /\/storage\/v1\/object\/([^\/]+)\/([^?]+)/;
        const match = urlObj.pathname.match(pathRegex);
        
        if (!match) {
          console.error('Could not parse Supabase URL pattern:', url);
          setError(true);
          return;
        }
        
        // match[1] will be "sign", "public", etc.
        // match[2] will be the rest of the path including bucket
        const accessType = match[1]; // e.g., "sign"
        const fullPath = match[2];   // e.g., "floor-textures/image.jpg"
        
        // Split the full path into bucket and object path
        const pathParts = fullPath.split('/');
        const bucketName = pathParts[0];
        const objectPath = pathParts.slice(1).join('/');
        
        console.log(`URL details: accessType=${accessType}, bucket=${bucketName}, path=${objectPath}`);
        
        // If the URL already has a token, just use it directly
        if (url.includes('token=')) {
          console.log('URL already has authentication token, using as-is');
          setProcessedUrl(url);
          return;
        }
        
        // Otherwise, generate a fresh URL
        if (accessType === 'sign') {
          // For signed URLs, we need to get a signed URL
          const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(objectPath, 3600); // 1 hour expiration
            
          if (error || !data?.signedUrl) {
            console.error('Failed to get signed URL for texture:', error);
            setError(true);
            return;
          }
          
          console.log('Generated signed URL:', data.signedUrl);
          setProcessedUrl(data.signedUrl);
        } 
        else {
          // For public URLs, use getPublicUrl
          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(objectPath);
            
          if (!data?.publicUrl) {
            console.error('Failed to get public URL for texture');
            setError(true);
            return;
          }
          
          // Add cache busting to prevent stale textures
          const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
          console.log('Using processed public URL:', publicUrl);
          setProcessedUrl(publicUrl);
        }
      } catch (error) {
        console.error('Error processing texture URL:', error);
        setError(true);
      }
    };
    
    handleTextureUrl();
  }, [url]);

  // If there was an error or we don't have a URL yet, show the fallback grid
  if (error || !processedUrl) {
    return (
      <DreiGrid
        position={[0, -0.01, 0]}
        cellSize={0.5}
        sectionSize={2.5}
        cellColor={fallbackColor}
        sectionColor={fallbackColor}
        cellThickness={1}
        sectionThickness={1.5}
        fadeDistance={25}
        fadeStrength={2}
        infiniteGrid={true}
        followCamera={true}
      />
    );
  }

  // When we have a processedUrl, render the inner component
  return <TexturedMesh url={processedUrl} size={size} />;
}

// Inner component that actually uses the texture hook
function TexturedMesh({ url, size = 20 }: { url: string; size?: number }) {
  const materialRef = useRef<MeshStandardMaterial>(null!);
  
  // Always call useTexture (no conditionals)
  const texture = useTexture(url);
  
  // Configure texture for tiling using useEffect only
  useEffect(() => {
    if (texture) {
      console.log("Applying texture settings for:", url);
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(10, 10); // Repeat the texture 10 times
      texture.minFilter = LinearFilter;
      texture.needsUpdate = true; // Signal texture properties changed
    }
  }, [texture, url]); // Run effect when texture object changes

  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.01, 0]} 
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        ref={materialRef}
        map={texture}
        color="#ffffff" 
        side={DoubleSide}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
} 