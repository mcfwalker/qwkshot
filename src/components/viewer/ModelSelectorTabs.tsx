'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModelLoader } from './ModelLoader';

interface ModelSelectorTabsProps {
  onModelSelect: (url: string) => void;
}

export function ModelSelectorTabs({ onModelSelect }: ModelSelectorTabsProps) {
  return (
    <Card className="bg-[#1D1D1D] rounded-[20px] border-0 flex flex-col w-[200px] p-4 gap-6">
      <CardHeader className="p-0">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">MODEL</CardTitle>
      </CardHeader>
      <ErrorBoundary name="ModelLoader">
        <ModelLoader onModelLoad={onModelSelect} />
      </ErrorBoundary>
    </Card>
  );
} 