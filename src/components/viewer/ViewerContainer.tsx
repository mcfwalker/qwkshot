'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ModelLoader } from './ModelLoader';
import { LibraryModelSelector } from './LibraryModelSelector';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Dynamically import the Viewer component with no SSR
const Viewer = dynamic(() => import("./Viewer"), { ssr: false });

export const ViewerContainer = () => {
  const [modelUrl, setModelUrl] = useState('');

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative bg-background">
      <ErrorBoundary name="ViewerContainer">
        <div className="absolute inset-0">
          <Viewer modelUrl={modelUrl} />
        </div>
        
        {/* Controls panel positioned on the right side */}
        <div className="absolute top-4 right-4 w-80 z-10 space-y-4">
          {/* Upload new model */}
          <ErrorBoundary name="ModelLoader">
            <ModelLoader onModelLoad={setModelUrl} />
          </ErrorBoundary>
          
          {/* Library model selector */}
          <ErrorBoundary name="LibraryModelSelector">
            <LibraryModelSelector onSelectModel={setModelUrl} />
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    </div>
  );
} 