'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModelLoader } from './ModelLoader';

interface ModelSelectorTabsProps {
  onModelSelect: (url: string) => void;
}

export function ModelSelectorTabs({ onModelSelect }: ModelSelectorTabsProps) {
  return (
    <Card className="viewer-panel">
      <CardHeader className="viewer-panel-header px-2">
        <CardTitle className="viewer-panel-title">Cast</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-6">
        <ErrorBoundary name="ModelLoader">
          <ModelLoader onModelLoad={onModelSelect} />
        </ErrorBoundary>
      </CardContent>
    </Card>
  );
} 