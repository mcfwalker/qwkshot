'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { LoadingOverlay, LoadingButton } from '@/components/shared/LoadingStates';

export const ModelLoader = ({ onModelLoad }: { onModelLoad: (url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      setError('Please upload a .glb or .gltf file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Create object URL for the file
      const url = URL.createObjectURL(file);
      onModelLoad(url);
    } catch (err) {
      console.error('Model loading error:', err);
      setError('Failed to load model');
    } finally {
      setLoading(false);
    }
  }, [onModelLoad]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/gltf-binary': ['.glb'],
      'model/gltf+json': ['.gltf']
    },
    multiple: false
  });

  return (
    <div className="relative">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8
          flex flex-col items-center justify-center
          transition-colors cursor-pointer
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
            <p className="text-xs text-destructive font-medium">
              {error}
            </p>
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