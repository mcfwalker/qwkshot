'use client';

import { useEffect, useState } from 'react';
import { Loader2, FolderOpen, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getModels, loadModel } from '@/lib/library-service';
import { LoadingSpinner, LoadingButton, ModelLoadingSkeleton } from '@/components/shared/LoadingStates';
import { createRetryableFunction } from '@/lib/retry-utils';
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
  const [retryingModelId, setRetryingModelId] = useState<string | null>(null);

  const fetchModelsWithRetry = createRetryableFunction(async () => {
    setLoading(true);
    setError(null);
    const fetchedModels = await getModels();
    setModels(fetchedModels);
  }, {
    maxAttempts: 3,
    onRetry: (error, attempt) => {
      toast.error('Failed to load models', {
        description: `Retrying... (Attempt ${attempt}/3)`,
      });
    }
  });

  useEffect(() => {
    fetchModelsWithRetry.execute().finally(() => setLoading(false));
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
      setRetryingModelId(model.id);
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleRetry = async (model: Model) => {
    try {
      setLoadingModelId(model.id);
      setError(null);
      setRetryingModelId(null);
      const modelUrl = await loadModel(model.id);
      onSelectModel(modelUrl);
    } catch (error) {
      console.error('Error loading model:', error);
      setError('Failed to load model');
      setRetryingModelId(model.id);
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleRefresh = () => {
    fetchModelsWithRetry.execute().finally(() => setLoading(false));
  };

  if (loading) {
    return <ModelLoadingSkeleton />;
  }

  return (
    <Card className="viewer-card">
      <CardHeader className="pb-3">
        <CardTitle className="viewer-title flex justify-between items-center">
          <div className="flex items-center">
            <FolderOpen className="viewer-button-icon" />
            Model Library
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
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
              <div key={model.id} className="space-y-2">
                <LoadingButton
                  onClick={() => handleModelSelect(model)}
                  className="w-full justify-start text-left"
                  loading={loadingModelId === model.id}
                >
                  {model.name}
                </LoadingButton>
                {retryingModelId === model.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetry(model)}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Loading
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 