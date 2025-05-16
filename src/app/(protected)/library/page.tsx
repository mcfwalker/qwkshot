'use client';

// Add this line to make this route dynamically rendered
// Note: 'force-dynamic' might not be needed here anymore as data fetching is in an action.
// export const dynamic = 'force-dynamic'; 

import { useState, useEffect } from 'react' // Import useEffect, Removed Suspense
// import { createServerClient } from '@/lib/supabase-server' // No longer needed here
import { Model } from '@/lib/supabase'
import { ModelGridSkeleton } from '@/components/library/ModelGridSkeleton'
import { ModelGridClient } from '@/components/library/ModelGridClient'
// import Image from 'next/image'; // Removed Image import
// import * as TabsPrimitive from '@radix-ui/react-tabs'; // Remove this
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Add this
// import { cn } from '@/lib/utils'; // Removed cn import
import { getModels } from '@/app/actions/libraryActions'; // Import server action
import { toast } from 'sonner'; // Import toast for error feedback

// REMOVE old data fetching logic
/*
async function getModels() { ... }
*/

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState('models');
  const [models, setModels] = useState<Model[]>([]); // State for models
  const [isLoading, setIsLoading] = useState(true); // State for loading

  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const fetchedModels = await getModels();
        setModels(fetchedModels);
      } catch (error) {
        toast.error('Failed to load models.', { 
          description: error instanceof Error ? error.message : 'Please try again later.'
        });
        setModels([]); // Set empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []); // Empty dependency array means run once on mount

  return (
    <div className="container px-4 pt-10 pb-8">
      {/* Flex container for header and tabs */}
      <div className="flex items-center gap-14 mb-10">
        {/* SVG Header Replaced with Text Header */}
        {/* <div style={{ width: '237px', height: '38px', position: 'relative' }}>
          <Image 
            src="/images/header_library.svg" 
            alt="Library Header"
            fill
            style={{ objectFit: 'contain' }}
          />
        </div> */}
        <h1 className="text-[#e2e2e2] font-sans text-[48px] font-extrabold leading-normal uppercase">
          Library
        </h1>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="flex items-center justify-center h-10 text-muted-foreground gap-4">
            <TabsTrigger
              value="models"
              variant="default"
            >
              MODELS
            </TabsTrigger>
            <TabsTrigger
              value="textures"
              variant="default"
            >
              TEXTURES
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <Tabs value={activeTab} className="mt-4">
          <TabsContent value="models">
            {/* Use isLoading state to conditionally render Skeleton or Client */}
            {isLoading ? (
              <ModelGridSkeleton />
            ) : (
              <ModelGridClient initialModels={models} />
            )}
          </TabsContent>
          <TabsContent value="textures">
            <div className="text-center text-muted-foreground p-8">
              Texture management coming soon!
            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}

// REMOVE old ModelsContent component
/*
async function ModelsContent() { ... }
*/ 