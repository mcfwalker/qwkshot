'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, RefreshCw, FolderOpen, FolderGit2, Library } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingStates';
import { Button } from '@/components/ui/button';
import { withRetry } from '@/lib/retry-utils';
import { uploadModel } from '@/lib/library-service';
import { toast } from 'sonner';
import { SaveModelPortal } from './SaveModelPortal';
import { LibraryModelPortal } from './LibraryModelPortal';
import { loadModel } from '@/lib/library-service';
import { P2PPipelineFactoryImpl } from '@/features/p2p/pipeline/P2PPipelineFactory';
import { P2PPipelineConfig, P2PPipeline } from '@/types/p2p/pipeline';
import { SceneAnalyzerFactory } from '@/features/p2p/scene-analyzer/SceneAnalyzerFactory';
import { MetadataManagerFactory } from '@/features/p2p/metadata-manager/MetadataManagerFactory';
import { PromptCompilerFactory } from '@/features/p2p/prompt-compiler';
import { LLMEngineFactory } from '@/features/p2p/llm-engine/LLMEngineFactory';
import { SceneInterpreterFactory } from '@/features/p2p/scene-interpreter/SceneInterpreterFactory';
import { EnvironmentalAnalyzerFactory } from '@/features/p2p/environmental-analyzer/EnvironmentalAnalyzerFactory';
import { cn } from '@/lib/utils';

export const ModelLoader = ({ onModelLoad }: { onModelLoad: (url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Create refs for the pipeline
  const pipelineRef = useRef<P2PPipeline | null>(null);
  const loggerRef = useRef({
    info: console.info,
    error: console.error,
    debug: console.debug,
    warn: console.warn,
    trace: console.trace,
    performance: console.log
  });

  // Initialize the pipeline once on component mount
  useEffect(() => {
    const initPipeline = async () => {
      try {
        setIsInitializing(true);
        
        // Initialize pipeline factory
        const pipelineFactory = new P2PPipelineFactoryImpl(
          new SceneAnalyzerFactory(loggerRef.current),
          new MetadataManagerFactory(loggerRef.current),
          new PromptCompilerFactory(loggerRef.current),
          new LLMEngineFactory(loggerRef.current),
          new SceneInterpreterFactory(loggerRef.current),
          new EnvironmentalAnalyzerFactory(loggerRef.current)
        );

        // Create pipeline instance
        const pipelineConfig: P2PPipelineConfig = {
          sceneAnalyzer: {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            supportedFormats: ['model/gltf-binary', 'model/gltf+json']
          },
          metadataManager: {
            database: {
              type: 'supabase',
              url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
              key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              table: 'model_metadata',
              schema: 'public'
            },
            caching: {
              enabled: true,
              ttl: 5 * 60 * 1000 // 5 minutes
            },
            validation: {
              strict: true,
              maxFeaturePoints: 100
            }
          },
          promptCompiler: {
            maxTokens: 1000,
            temperature: 0.7
          },
          llmEngine: {
            model: 'gpt-4',
            maxTokens: 1000,
            temperature: 0.7
          },
          sceneInterpreter: {
            smoothingFactor: 0.5,
            maxKeyframes: 100
          },
          environmentalAnalyzer: {
            environmentSize: {
              width: 100,
              height: 100,
              depth: 100
            },
            analysisOptions: {
              calculateDistances: true,
              validateConstraints: true,
              optimizeCameraSpace: true
            }
          }
        };

        const pipeline = pipelineFactory.create(pipelineConfig, loggerRef.current);
        
        // Important: Initialize the pipeline and wait for it to complete
        await pipeline.initialize();
        
        // Only set the ref after successful initialization
        pipelineRef.current = pipeline;
        console.log('Pipeline initialized successfully');
        setIsInitializing(false);
      } catch (err) {
        console.error('Failed to initialize pipeline:', err);
        setError('Failed to initialize processing pipeline');
        setIsInitializing(false);
      }
    };

    initPipeline();
    
    // Cleanup function
    return () => {
      pipelineRef.current = null;
    };
  }, []);

  const processFile = async (file: File) => {
    if (!pipelineRef.current) {
      throw new Error('Pipeline not initialized');
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      throw new Error('Please upload a .glb or .gltf file');
    }

    // Create object URL for the file
    const url = URL.createObjectURL(file);
    onModelLoad(url);

    // Process the model through the pipeline
    const { modelId } = await pipelineRef.current.processModel({
      file,
      userId: 'current-user-id' // TODO: Get actual user ID
    });

    return modelId;
  };

  const handleFile = async (file: File) => {
    if (isInitializing) {
      toast.error('System is still initializing. Please wait a moment and try again.');
      return;
    }
    
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
  }, [isInitializing]); // Include isInitializing in dependencies

  const handleRetry = async () => {
    if (!currentFile) return;
    await handleFile(currentFile);
  };

  const handleSaveModel = async (name: string) => {
    if (!currentFile || !pipelineRef.current) return;
    
    try {
      // Process the model first to get metadata
      const { modelId, analysis, metadata } = await pipelineRef.current.processModel({
        file: currentFile,
        userId: 'current-user-id' // TODO: Get actual user ID
      });

      // Save the model with the processed metadata
      const savedModel = await uploadModel(currentFile, {
        name,
        description: '',
        tags: [],
        metadata: {
          size: currentFile.size,
          format: currentFile.name.split('.').pop() || 'unknown',
          geometry: {
            vertexCount: analysis.glb.geometry.vertexCount,
            faceCount: analysis.glb.geometry.faceCount,
            boundingBox: {
              min: {
                x: analysis.glb.geometry.boundingBox.min.x,
                y: analysis.glb.geometry.boundingBox.min.y,
                z: analysis.glb.geometry.boundingBox.min.z
              },
              max: {
                x: analysis.glb.geometry.boundingBox.max.x,
                y: analysis.glb.geometry.boundingBox.max.y,
                z: analysis.glb.geometry.boundingBox.max.z
              }
            },
            center: {
              x: analysis.glb.geometry.center.x,
              y: analysis.glb.geometry.center.y,
              z: analysis.glb.geometry.center.z
            },
            dimensions: {
              x: analysis.glb.geometry.dimensions.x,
              y: analysis.glb.geometry.dimensions.y,
              z: analysis.glb.geometry.dimensions.z
            }
          },
          spatial: {
            bounds: {
              min: {
                x: analysis.spatial.bounds.min.x,
                y: analysis.spatial.bounds.min.y,
                z: analysis.spatial.bounds.min.z
              },
              max: {
                x: analysis.spatial.bounds.max.x,
                y: analysis.spatial.bounds.max.y,
                z: analysis.spatial.bounds.max.z
              },
              center: {
                x: analysis.spatial.bounds.center.x,
                y: analysis.spatial.bounds.center.y,
                z: analysis.spatial.bounds.center.z
              },
              dimensions: {
                x: analysis.spatial.bounds.dimensions.x,
                y: analysis.spatial.bounds.dimensions.y,
                z: analysis.spatial.bounds.dimensions.z
              }
            },
            complexity: analysis.spatial.complexity,
            symmetry: {
              hasSymmetry: analysis.spatial.symmetry.hasSymmetry,
              symmetryPlanes: analysis.spatial.symmetry.symmetryPlanes.map(plane => ({
                normal: {
                  x: plane.normal.x,
                  y: plane.normal.y,
                  z: plane.normal.z
                },
                constant: plane.constant
              }))
            }
          },
          orientation: metadata.orientation,
          preferences: metadata.preferences,
          performance_metrics: {
            sceneAnalysis: analysis.performance,
            spatialAnalysis: analysis.spatial.performance,
            featureAnalysis: analysis.featureAnalysis.performance
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      });

      // Update the URL to include the model ID
      const newPath = `/viewer/${savedModel.id}`;
      window.history.pushState({}, '', newPath);

      // Get the signed URL for the model
      const url = await loadModel(savedModel.id);
      onModelLoad(url);
    } catch (error) {
      console.error('Error saving model:', error);
      toast.error('Failed to save model');
    }
  };

  const handleLibrarySelect = async (model: any) => {
    try {
      setLoading(true);
      const url = await loadModel(model.id);
      // Update the URL to include the model ID
      const newPath = `/viewer/${model.id}`;
      window.history.pushState({}, '', newPath);
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
    multiple: false,
    disabled: isInitializing // Disable dropzone during initialization
  });

  return (
    <>
      <div className="relative">
        <div
          {...getRootProps()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 h-[128px] p-4 rounded-xl border border-dashed border-[#444444] text-center cursor-pointer",
            isDragActive && 'border-primary bg-primary/5',
            error && 'border-destructive',
            isInitializing && 'opacity-60 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          
          {isInitializing ? (
            <div className="text-center">
              <RefreshCw className="h-6 w-6 mb-4 text-muted-foreground animate-spin mx-auto" />
              <p className="text-sm font-medium">Initializing system...</p>
              <p className="text-xs text-muted-foreground italic font-light">
                Please wait a moment
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-5 w-5 mb-1 text-muted-foreground" />
              
              <div className="text-center space-y-0.5">
                <p className="text-sm font-medium text-foreground">Drop your model here</p>
                <p className="text-xs text-muted-foreground font-light">Supports .glb and .gltf</p>
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
            </>
          )}
        </div>

        {loading && <LoadingOverlay message="Processing model..." />}
      </div>

      <Button
        variant="secondary"
        className={cn(
          "w-full h-10 px-3 py-0 inline-flex items-center justify-center gap-2.5",
          "rounded-xl border-0 bg-[#353535] shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)]",
          "hover:bg-[#404040]",
          "disabled:opacity-70 disabled:pointer-events-none",
          "text-sm text-foreground/80"
        )}
        size="default"
        onClick={() => setShowLibraryModal(true)}
        disabled={isInitializing}
      >
        Library
      </Button>

      {showSaveDialog && currentFile && (
        <SaveModelPortal
          isOpen={showSaveDialog}
          onSave={handleSaveModel}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

      {showLibraryModal && (
        <LibraryModelPortal
          isOpen={showLibraryModal}
          onSelect={handleLibrarySelect}
          onClose={() => setShowLibraryModal(false)}
        />
      )}
    </>
  );
}; 