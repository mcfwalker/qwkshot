'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
// import { ModelSelectorTabs } from './ModelSelectorTabs';
import { loadModel } from '@/lib/library-service'; 
import { toast } from 'sonner';

// Dynamically import the Viewer component with no SSR
const Viewer = dynamic(() => import("./Viewer"), { ssr: false });

// Define props for ViewerContainer
interface ViewerContainerProps {
  // Make modelId optional with ?
  modelId?: string; 
}

export const ViewerContainer = ({ modelId }: ViewerContainerProps) => {
  // Initialize modelUrl state to null initially
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch signed URL when modelId prop changes
  useEffect(() => {
    // Don't reset modelUrl or set loading state if no modelId
    if (!modelId) {
      return;
    }
    
    // Only now set loading state since we have a modelId to fetch
    setModelUrl(null);
    setIsLoading(true);
    setError(null);

    async function getSignedUrl() {
      try {
        // Use type assertion since we already checked modelId is not undefined above
        const url = await loadModel(modelId as string);
        setModelUrl(url); 
        setError(null);
      } catch (err) {
        console.error('Error getting signed URL in ViewerContainer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model URL');
        setModelUrl(null); // Clear URL on error
        toast.error('Failed to load model URL') // Show toast on error
      } finally {
         setIsLoading(false); 
      }
    }

    getSignedUrl();

  }, [modelId]); // Dependency is modelId

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative bg-background">
      <ErrorBoundary name="ViewerContainer">
        <div className="absolute inset-0">
          <Viewer 
            className="w-full h-full" 
            modelUrl={modelUrl} // Pass the fetched URL state
            onModelSelect={setModelUrl} // Keep this if Viewer needs to clear/change URL
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}; 