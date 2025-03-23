'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Loader2, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ModelLoaderProps {
  onModelLoad: (url: string) => void;
}

export default function ModelLoader({ onModelLoad }: ModelLoaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Check if file is a supported 3D format
    const supportedFormats = ['.gltf', '.glb'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!supportedFormats.includes(fileExtension)) {
      setError('Unsupported file format. Please upload a GLTF or GLB file.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Create a URL for the uploaded file
      const objectUrl = URL.createObjectURL(file);
      onModelLoad(objectUrl);
    } catch (err) {
      setError('Failed to load model. Please try again.');
      console.error('Model loading error:', err);
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
    maxFiles: 1
  });

  return (
    <Card className="viewer-card">
      <CardHeader className="pb-3">
        <CardTitle className="viewer-title">
          <Upload className="viewer-button-icon" />
          Upload Model
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border/50'}
            ${loading ? 'pointer-events-none opacity-50' : ''}
            bg-secondary/20 hover:bg-secondary/30
          `}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading model...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {isDragActive
                  ? 'Drop the model here...'
                  : 'Drag and drop a 3D model, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Supported formats: GLTF, GLB
              </p>
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
        
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="viewer-button w-full"
            onClick={() => onModelLoad('')}
            disabled={loading}
          >
            <X className="viewer-button-icon" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 