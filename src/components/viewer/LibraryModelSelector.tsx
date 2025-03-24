'use client';

import { useEffect, useState } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getModels, loadModel } from '@/lib/library-service';
import { LoadingSpinner, LoadingButton, ModelLoadingSkeleton } from '@/components/shared/LoadingStates';
import { toast } from 'sonner';
import { Model } from '@/lib/supabase';

interface LibraryModelSelectorProps {
  onSelectModel: (url: string) => void;
}

export const LibraryModelSelector = ({ onSelectModel }: LibraryModelSelectorProps) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedModels = await getModels();
        setModels(fetchedModels);
      } catch (error) {
        console.error('Error loading models:', error);
        setError('Failed to load models');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleModelSelect = async (model: Model) => {
    try {
      setLoadingModelId(model.id);
      setError(null);
      const modelUrl = await loadModel(model.id);
      onSelectModel(modelUrl);
    } catch (error) {
      console.error('Error loading model:', error);
      setError('Failed to load model');
    } finally {
      setLoadingModelId(null);
    }
  };

  if (loading) {
    return <ModelLoadingSkeleton />;
  }

  return (
    <Card className="viewer-card">
      <CardHeader className="pb-3">
        <CardTitle className="viewer-title">
          <FolderOpen className="viewer-button-icon" />
          Model Library
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}
        
        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No models in library
          </p>
        ) : (
          <div className="space-y-2">
            {models.map((model) => (
              <LoadingButton
                key={model.id}
                onClick={() => handleModelSelect(model)}
                className="w-full justify-start text-left"
                loading={loadingModelId === model.id}
              >
                {model.name}
              </LoadingButton>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 