'use client';

// Add this line to make this route dynamically rendered
// Note: 'force-dynamic' might not be needed here anymore as data fetching is in an action.
// export const dynamic = 'force-dynamic'; 

import { Suspense, useState, useEffect } from 'react' // Import useEffect
// import { createServerClient } from '@/lib/supabase-server' // No longer needed here
import { Model } from '@/lib/supabase'
import { ModelGridSkeleton } from '@/components/library/ModelGridSkeleton'
import { ModelGridClient } from '@/components/library/ModelGridClient'
import Image from 'next/image';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
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
        console.log('Debug: Library Page - Calling getModels action');
        const fetchedModels = await getModels();
        console.log('Debug: Library Page - Received models from action');
        setModels(fetchedModels);
  } catch (error) {
        console.error('Error fetching models in component:', error);
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

  console.log('Debug: Library - Page component rendering');
  return (
    <div className="container px-4 pt-10 pb-8">
      {/* Flex container for header and tabs */}
      <div className="flex items-center gap-6 mb-10">
        {/* SVG Header */}
        <div style={{ width: '237px', height: '38px', position: 'relative' }}>
          <Image
            src="/images/header_library.svg"
            alt="Library Header"
            layout="fill"
            objectFit="contain"
          />
        </div>

        {/* Tabs */}
        <TabsPrimitive.Root
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsPrimitive.List className="flex items-center justify-center h-10 text-muted-foreground gap-4">
            <TabsPrimitive.Trigger
              value="models"
              className={cn(
                "flex h-10 min-w-[83px] px-9 justify-center items-center gap-2.5 text-sm font-medium uppercase transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                activeTab === 'models' 
                  ? "bg-[#2A2A2A] text-[#C2F751] rounded-xl shadow-md" 
                  : "text-[#CFD0D0] hover:text-[#FFFFFF]"
              )}
            >
              MODELS
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              value="textures"
              className={cn(
                "flex h-10 min-w-[83px] px-9 justify-center items-center gap-2.5 text-sm font-medium uppercase transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                activeTab === 'textures' 
                  ? "bg-[#2A2A2A] text-[#C2F751] rounded-xl shadow-md" 
                  : "text-[#CFD0D0] hover:text-[#FFFFFF]"
              )}
            >
              TEXTURES
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>
        </TabsPrimitive.Root>
      </div>

      {/* Tab Content */}
      <TabsPrimitive.Root value={activeTab} className="mt-4">
          <TabsPrimitive.Content value="models">
            {/* Use isLoading state to conditionally render Skeleton or Client */}
            {isLoading ? (
              <ModelGridSkeleton />
            ) : (
              <ModelGridClient initialModels={models} />
            )}
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="textures">
            <div className="text-center text-muted-foreground p-8">
              Texture management coming soon!
            </div>
          </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </div>
  )
}

// REMOVE old ModelsContent component
/*
async function ModelsContent() { ... }
*/ 