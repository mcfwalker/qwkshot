'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
// import { ModelSelectorTabs } from './ModelSelectorTabs';
import { loadModel } from '@/lib/library-service'; 
import { toast } from 'sonner';
import { useViewerStore } from '@/store/viewerStore'; // Import the store

// Dynamically import the Viewer component with no SSR
const Viewer = dynamic(() => import("./Viewer"), { ssr: false });

// Define props for ViewerContainer
interface ViewerContainerProps {
  // This is the modelId from the URL path param
  modelId?: string;
}

export const ViewerContainer = ({ modelId: pathModelId }: ViewerContainerProps) => {
  console.log('[ViewerContainer] Initializing. pathModelId from props:', pathModelId);

  // Initialize modelUrl state to null initially
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get modelId from Zustand store and its setter
  const { modelId: storeModelId, setModelId: setStoreModelId } = useViewerStore();

  // Determine the effective modelId to use for loading
  // Priority: pathModelId (from URL) > storeModelId (from Zustand)
  const effectiveModelId = pathModelId || storeModelId;
  console.log('[ViewerContainer] Calculated effectiveModelId:', effectiveModelId, '(path:', pathModelId, ', store:', storeModelId, ')');

  // Effect to sync pathModelId with the store if pathModelId is provided
  useEffect(() => {
    console.log(`[ViewerContainer] SYNC useEffect triggered. pathModelId: ${pathModelId}, storeModelId: ${storeModelId}, modelUrl: ${modelUrl ? "Exists" : "null"}`);

    if (pathModelId && pathModelId !== storeModelId) {
      console.log(`[ViewerContainer] SYNC useEffect: Path (${pathModelId}) differs from store (${storeModelId}). Setting store to path.`);
      setStoreModelId(pathModelId);
    } else if (!pathModelId && storeModelId) {
      console.log(`[ViewerContainer] SYNC useEffect: Path is empty, but store has model (${storeModelId}). Current modelUrl: ${modelUrl ? "Exists" : "null"}. NO LONGER CLEARING storeModelId or modelUrl here.`);
      // The following lines were causing the model to disappear and state to be lost.
      // console.log('[ViewerContainer] SYNC useEffect: WOULD HAVE CLEARED storeModelId and modelUrl HERE!'); // Logging for verification
      // setStoreModelId(null); 
      // if (modelUrl) setModelUrl(null);
    } else if (pathModelId && !storeModelId) {
      console.log(`[ViewerContainer] SYNC useEffect: Path (${pathModelId}) exists, store is empty. Setting store to path.`);
      setStoreModelId(pathModelId);
    } else {
      console.log(`[ViewerContainer] SYNC useEffect: No changes needed. pathModelId: ${pathModelId}, storeModelId: ${storeModelId}`);
    }
  }, [pathModelId, storeModelId, setStoreModelId, modelUrl]);

  // Fetch signed URL when the effectiveModelId changes
  useEffect(() => {
    console.log('[ViewerContainer] MAIN useEffect triggered. effectiveModelId:', effectiveModelId, '(path:', pathModelId, ', store:', storeModelId, ')', 'modelUrl:', modelUrl ? "Exists" : "null");

    if (!effectiveModelId) {
      console.log('[ViewerContainer] MAIN useEffect: No effectiveModelId. Clearing modelUrl, isLoading, error.');
      if (modelUrl !== null) setModelUrl(null);
      if (isLoading) setIsLoading(false);
      if (error !== null) setError(null);
      return;
    }

    if (typeof effectiveModelId !== 'string' || effectiveModelId.trim() === '') {
      console.warn('[ViewerContainer] MAIN useEffect: Attempted to load model with invalid effectiveModelId:', effectiveModelId);
      setIsLoading(false);
      setError('Invalid model ID for loading.');
      if (modelUrl !== null) setModelUrl(null);
      return;
    }

    const getSignedUrl = async () => {
      console.log(`[ViewerContainer] getSignedUrl: Attempting to load model for effectiveModelId: ${effectiveModelId}`);
      setIsLoading(true);
      setError(null);
      try {
        const url = await loadModel(effectiveModelId as string);
        console.log(`[ViewerContainer] getSignedUrl: Successfully loaded model URL for ${effectiveModelId}:`, url);
        setModelUrl(url);
      } catch (e: any) {
        console.error(`[ViewerContainer] getSignedUrl: Failed to load model for ${effectiveModelId}:`, e);
        setError(e.message || 'Failed to load model.');
        toast.error('Failed to load model', { description: e.message });
        setModelUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    console.log(`[ViewerContainer] MAIN useEffect: Calling getSignedUrl for effectiveModelId: ${effectiveModelId}`);
    getSignedUrl();

  }, [effectiveModelId, pathModelId, storeModelId]);

  const handleModelSelectionInViewer = useCallback((newModelId: string | null) => {
    console.log(`[ViewerContainer] handleModelSelectionInViewer: Called with newModelId: ${newModelId}. Current storeModelId: ${storeModelId}`);
    if (newModelId !== storeModelId) {
      console.log(`[ViewerContainer] handleModelSelectionInViewer: Updating storeModelId from ${storeModelId} to ${newModelId}`);
      setStoreModelId(newModelId);
    } else {
      console.log(`[ViewerContainer] handleModelSelectionInViewer: newModelId (${newModelId}) is same as storeModelId (${storeModelId}). No change.`);
    }
  }, [setStoreModelId, storeModelId]);

  console.log(`[ViewerContainer] Rendering. isLoading: ${isLoading}, modelUrl: ${modelUrl ? 'Exists' : 'null'}, error: ${error}`);

  if (error && !modelUrl && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative bg-background">
      <ErrorBoundary name="ViewerContainer">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
            <p className="text-white">Loading model...</p> {/* Basic loading indicator */}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
            <p className="text-red-500">{error}</p> {/* Basic error indicator */}
          </div>
        )}
        <div className="absolute inset-0">
          <Viewer 
            className="w-full h-full" 
            modelUrl={modelUrl} // Pass the fetched URL state
            onModelSelect={handleModelSelectionInViewer} // Pass the new handler
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}; 