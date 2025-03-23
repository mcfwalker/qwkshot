'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import ModelLoader from './ModelLoader';
import LibraryModelSelector from './LibraryModelSelector';

// Dynamically import the Viewer component with no SSR
const Viewer = dynamic(() => import("./Viewer"), { ssr: false });

export default function ViewerContainer() {
  const [modelUrl, setModelUrl] = useState('');

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative bg-background">
      <div className="absolute inset-0">
        <Viewer modelUrl={modelUrl} />
      </div>
      
      {/* Controls panel positioned on the right side */}
      <div className="absolute top-4 right-4 w-80 z-10 space-y-4">
        {/* Upload new model */}
        <ModelLoader onModelLoad={setModelUrl} />
        
        {/* Library model selector */}
        <LibraryModelSelector onSelectModel={setModelUrl} />
      </div>
    </div>
  );
} 