'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModelLoader } from './ModelLoader';

interface ModelSelectorTabsProps {
  onModelSelect: (url: string) => void;
}

export function ModelSelectorTabs({ onModelSelect }: ModelSelectorTabsProps) {
  return (
    // <Card className="bg-[#1D1D1D] rounded-xl border-0 flex flex-col w-[200px] p-4 gap-6">
      <ErrorBoundary name="ModelLoader">
        <ModelLoader onModelLoad={onModelSelect} />
      </ErrorBoundary>
    // </Card>
  );
} 