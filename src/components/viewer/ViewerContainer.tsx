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
  // Remove initialModelUrl, add modelId
  // initialModelUrl: string | null;
  modelId: string; 
}

export const ViewerContainer = ({ modelId }: ViewerContainerProps) => {
  // Initialize modelUrl state to null initially
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state

  // Fetch signed URL when modelId prop changes
  useEffect(() => {
    // Reset state when modelId changes
    setModelUrl(null);
    setIsLoading(true);
    setError(null);

    if (!modelId) { // Handle null/undefined modelId if necessary
       console.warn("ViewerContainer received null/undefined modelId");
       setIsLoading(false);
       setError("No model ID provided.");
       return;
    }

    async function getSignedUrl() {
      console.log(`[ViewerContainer] Fetching signed URL for modelId: ${modelId}`);
      try {
        const url = await loadModel(modelId); // Call client-side function here
        console.log(`[ViewerContainer] Received signed URL: ${url}`);
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

  // Optional: Add loading/error display here if needed, 
  // although Viewer might handle null modelUrl gracefully.
  // if (isLoading) return <div>Loading Model...</div>;
  // if (error) return <div>Error: {error}</div>;

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