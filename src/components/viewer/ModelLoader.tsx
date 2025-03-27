'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, RefreshCw, FolderOpen } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingStates';
import { Button } from '@/components/ui/button';
import { withRetry } from '@/lib/retry-utils';
import { uploadModel } from '@/lib/library-service';
import { toast } from 'sonner';
import { SaveModelPortal } from './SaveModelPortal';
import { LibraryModelPortal } from './LibraryModelPortal';
import { loadModel } from '@/lib/library-service';

export const ModelLoader = ({ onModelLoad }: { onModelLoad: (url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

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
      // Show save dialog after successful load
      setShowSaveDialog(true);
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

  const handleSaveModel = async (name: string) => {
    if (!currentFile) return;
    
    try {
      await uploadModel(currentFile, {
        name,
        description: '',
        tags: [],
        metadata: {
          size: currentFile.size,
          format: currentFile.name.split('.').pop() || 'unknown'
        }
      });
      toast.success('Model saved to library');
    } catch (error) {
      console.error('Failed to save model:', error);
      toast.error('Failed to save model to library');
      throw error; // Propagate error to dialog
    }
  };

  const handleLibrarySelect = async (model: any) => {
    try {
      setLoading(true);
      const url = await loadModel(model.id);
      onModelLoad(url);
    } catch (error) {
      console.error('Error loading model:', error);
      toast.error('Failed to load model from library');
    } finally {
      setLoading(false);
    }
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
    <>
      <div className="space-y-4">
        <div className="relative">
          <div
            {...getRootProps()}
            className={`
              viewer-drop-zone p-8
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
              ${error ? 'border-destructive' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <Upload className="h-6 w-6 mb-4 text-muted-foreground" />
            
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">
                {isDragActive ? 'Drop your model here' : 'Drop your model here'}
              </p>
              <p className="text-xs text-muted-foreground italic font-light">
                Supports .glb and .gltf
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
          </div>

          {loading && (
            <LoadingOverlay message="Loading model..." />
          )}
        </div>

        <Button
          onClick={() => setShowLibraryModal(true)}
          variant="secondary"
          size="default"
          className="flex-1 border border-[#444444] hover:bg-secondary/20 data-[disabled]:opacity-30 data-[disabled]:pointer-events-none"
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Library
        </Button>
      </div>

      <SaveModelPortal
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveModel}
      />

      <LibraryModelPortal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelect={handleLibrarySelect}
      />
    </>
  );
}; 