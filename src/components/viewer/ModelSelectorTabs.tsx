'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelLoader } from './ModelLoader';
import { LibraryModelSelector } from './LibraryModelSelector';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Upload, FolderOpen } from 'lucide-react';

interface ModelSelectorTabsProps {
  onModelSelect: (url: string) => void;
}

export function ModelSelectorTabs({ onModelSelect }: ModelSelectorTabsProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle>Cast</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Library
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-0">
            <ErrorBoundary name="ModelLoader">
              <ModelLoader onModelLoad={onModelSelect} />
            </ErrorBoundary>
          </TabsContent>
          
          <TabsContent value="library" className="mt-0">
            <ErrorBoundary name="LibraryModelSelector">
              <LibraryModelSelector onSelectModel={onModelSelect} />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 