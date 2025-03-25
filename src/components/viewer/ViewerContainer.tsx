'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModelSelectorTabs } from './ModelSelectorTabs';

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
        
        {/* Cast panel positioned on the left side */}
        <div className="absolute top-4 left-4 w-80 z-10">
          <ErrorBoundary name="ModelSelectorTabs">
            <ModelSelectorTabs onModelSelect={setModelUrl} />
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    </div>
  );
}; 