'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModelLoader } from './ModelLoader';
import { LibraryModelSelector } from './LibraryModelSelector';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

interface ModelSelectorTabsProps {
  onModelSelect: (url: string) => void;
}

export function ModelSelectorTabs({ onModelSelect }: ModelSelectorTabsProps) {
  return (
    <Card className="viewer-panel">
      <CardHeader className="viewer-panel-header px-2">
        <CardTitle className="viewer-panel-title">Cast</CardTitle>
      </CardHeader>
      <CardContent className="viewer-panel-content">
        <Tabs defaultValue="upload" className="viewer-tabs">
          <TabsList>
            <TabsTrigger value="upload">
              Upload
            </TabsTrigger>
            <TabsTrigger value="library">
              Library
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <ErrorBoundary name="ModelLoader">
              <ModelLoader onModelLoad={onModelSelect} />
            </ErrorBoundary>
          </TabsContent>
          
          <TabsContent value="library">
            <ErrorBoundary name="LibraryModelSelector">
              <LibraryModelSelector onSelectModel={onModelSelect} />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 