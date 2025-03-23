'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Model } from '@/lib/supabase';

interface LibraryModelSelectorProps {
  onSelectModel: (url: string) => void;
}

export default function LibraryModelSelector({ onSelectModel }: LibraryModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setModels(data || []);
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Failed to load models from library');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectModel(model: Model) {
    try {
      setLoadingModelId(model.id);
      
      // Get the signed URL for the model file
      const { data, error } = await supabase
        .storage
        .from('models')
        .createSignedUrl(model.file_url, 3600); // 1 hour expiration
      
      if (error) {
        throw error;
      }

      if (data?.signedUrl) {
        // Call the onSelectModel with the signed URL
        onSelectModel(data.signedUrl);
        toast.success(`Loaded: ${model.name}`);
      } else {
        throw new Error('Failed to get signed URL for model');
      }
    } catch (error) {
      console.error('Error loading model:', error);
      toast.error(`Failed to load model: ${model.name}`);
    } finally {
      setLoadingModelId(null);
    }
  }

  return (
    <Card className="viewer-card">
      <CardHeader className="pb-3">
        <CardTitle className="viewer-title">
          <FolderOpen className="viewer-button-icon" />
          Library Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading models...</span>
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No models in library</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-2">
              {models.map((model) => (
                <div 
                  key={model.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <div className="truncate">
                    <p className="text-sm font-medium">{model.name}</p>
                    {model.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {model.description}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectModel(model)}
                    disabled={loadingModelId === model.id}
                    className="viewer-button"
                  >
                    {loadingModelId === model.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Load'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="viewer-button w-full"
            onClick={loadModels}
            disabled={loading}
          >
            <Loader2 className={`viewer-button-icon ${loading ? 'animate-spin' : ''}`} />
            Refresh Models
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 