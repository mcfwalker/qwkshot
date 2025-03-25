'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, RefreshCw } from 'lucide-react';
import { LoadingOverlay, LoadingButton } from '@/components/shared/LoadingStates';
import { Button } from '@/components/ui/button';
import { withRetry } from '@/lib/retry-utils';
import { toast } from 'sonner';

export const ModelLoader = ({ onModelLoad }: { onModelLoad: (url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      throw new Error('Please upload a .glb or .gltf file');
    }

    // Create object URL for the file
    const url = URL.createObjectURL(file);
    onModelLoad(url);
    return url;
  };

  const handleFile = async (file: File) => {
    setCurrentFile(file);
    setLoading(true);
    setError(null);

    try {
      await withRetry(
        () => processFile(file),
        {
          maxAttempts: 3,
          onRetry: (error, attempt) => {
            toast.error('Failed to process model', {
              description: `Retrying... (Attempt ${attempt}/3)`,
            });
          }
        }
      );
    } catch (err) {
      console.error('Model loading error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    await handleFile(file);
  }, []);

  const handleRetry = async () => {
    if (!currentFile) return;
    await handleFile(currentFile);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/gltf-binary': ['.glb'],
      'model/gltf+json': ['.gltf']
    },
    multiple: false
  });

  return (
    <div className="relative p-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6
          flex flex-col items-center justify-center
          transition-colors cursor-pointer min-h-[12rem]
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
          ${error ? 'border-destructive' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <Upload className="h-8 w-8 mb-4 text-muted-foreground" />
        
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">
            {isDragActive ? 'Drop the model here' : 'Drag & drop model here'}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports .glb and .gltf files
          </p>
          {error && (
            <div className="space-y-2">
              <p className="text-xs text-destructive font-medium">
                {error}
              </p>
              {currentFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>

        <LoadingButton
          type="button"
          onClick={e => e.stopPropagation()}
          className="mt-4"
          loading={loading}
        >
          Select File
        </LoadingButton>
      </div>

      {loading && (
        <LoadingOverlay message="Loading model..." />
      )}
    </div>
  );
}; 