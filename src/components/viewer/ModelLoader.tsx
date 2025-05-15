'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, RefreshCw, FolderOpen, FolderGit2, Library } from 'lucide-react';
import { LoadingOverlay } from '@/components/shared/LoadingStates';
import { Button } from '@/components/ui/button';
import { withRetry } from '@/lib/retry-utils';
import { supabase } from '@/lib/supabase';
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
import { prepareModelUpload } from '@/app/actions/models';
import { normalizeModelAction } from '@/app/actions/normalization';

export const ModelLoader = ({ onModelLoad }: { onModelLoad: (url: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing model...');
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentAnalysisMetadata, setCurrentAnalysisMetadata] = useState<any | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // Keep track of analysis state to know when to show loading in the dialog vs overlay
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  
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
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      throw new Error('Please upload a .glb or .gltf file');
    }

    // Set loading message before any processing
    setLoadingMessage('Analyzing scene...');
    
    // Run client-side analysis to get metadata for saving
    const { modelId: tempModelId, analysis, metadata } = await pipelineRef.current.processModel({
      file,
      userId: 'current-user-id'
    });
    
    setCurrentAnalysisMetadata(metadata);
    setIsAnalyzed(true);
    
    return metadata; // Return metadata so caller can access it
  };

  const handleFile = async (file: File) => {
    if (isInitializing) {
      toast.error('System is still initializing. Please wait a moment and try again.');
      return;
    }
    
    // Just set the file and show save dialog first - don't analyze yet
    setCurrentFile(file);
    setError(null);
    setShowSaveDialog(true);
  };

  const handleSaveModel = async (name: string) => {
    if (!currentFile) {
      toast.error('No file selected.');
      return;
    }

    // Now start the processing with the provided name
    setLoading(true);
    setLoadingMessage('Analyzing scene...');
    
    try {
      // Process the file first and get metadata
      const metadata = await processFile(currentFile);
      
      if (!metadata) {
        throw new Error('Failed to analyze model.');
      }
      
      // Set metadata explicitly from the result
      setCurrentAnalysisMetadata(metadata);
      setIsAnalyzed(true);
      
      // Continue with save process
      setLoadingMessage('Saving model metadata...');

      // --- Get User ID --- 
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Authentication error', { description: userError?.message || 'User not found.' });
        throw new Error(userError?.message || 'User not found');
      }
      const userId = user.id;

      // Call the server action to prepare upload and save metadata
      const prepareResult = await prepareModelUpload({
        fileName: currentFile.name,
        fileSize: currentFile.size,
        fileType: currentFile.type,
        userId: userId, 
        modelName: name,
        initialMetadata: metadata  // Use metadata directly from processFile
      });

      if (prepareResult.error || !prepareResult.signedUploadUrl) {
        throw new Error(prepareResult.error || 'Failed to prepare upload (missing URL).');
      }
      
      const { modelId, signedUploadUrl } = prepareResult;
      loggerRef.current.info('Received signed URL and model ID from server action', { modelId });

      setLoadingMessage('Uploading file...');
      
      const uploadResponse = await fetch(signedUploadUrl, {
        method: 'PUT',
        body: currentFile,
        headers: {
          // Supabase signed URL uploads might need content-type depending on policy/setup
          // 'Content-Type': currentFile.type 
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        loggerRef.current.error('Direct storage upload failed using fetch:', { 
          status: uploadResponse.status, 
          statusText: uploadResponse.statusText,
          body: errorText
        });
        throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
      }

      loggerRef.current.info('File uploaded successfully to storage via fetch.');

      // --- Trigger Backend Normalization --- 
      setLoadingMessage('Normalizing model geometry...');
      loggerRef.current.info(`Calling normalizeModelAction for modelId: ${modelId}`);
      const normalizeResult = await normalizeModelAction(modelId);
      
      if (!normalizeResult.success) {
        loggerRef.current.warn('Backend normalization failed:', normalizeResult.error);
        toast.warning('Model saved, but normalization failed.', { description: normalizeResult.error });
      } else {
        loggerRef.current.info('Backend normalization completed successfully.');
      }

      // --- Load the final (normalized) model URL for display --- 
      setLoadingMessage('Loading final model...');
      try {
        const finalUrl = await loadModel(modelId); 
        onModelLoad(finalUrl); // Update the viewer with the URL from storage
        loggerRef.current.info('Viewer updated with final model URL from storage.');
      } catch (loadError) {
        loggerRef.current.error('Failed to load final model URL after save/normalization:', loadError);
        toast.error('Failed to display final model', { description: loadError instanceof Error ? loadError.message : undefined });
      }

      const newPath = `/viewer/${modelId}`;
      window.history.pushState({}, '', newPath);
      toast.success('Model saved successfully!');

    } catch (err) {
      console.error('Model processing/saving error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process/save model');
    } finally {
      // Now that everything is done, close the dialog
      setShowSaveDialog(false);
      setLoading(false);
      setCurrentFile(null);
      setCurrentAnalysisMetadata(null);
    }
  };

  const handleLibrarySelect = async (model: any) => {
    try {
      setLoading(true);
      const url = await loadModel(model.id);
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    await handleFile(file);
  }, [isInitializing]);

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
    multiple: false,
    disabled: isInitializing
  });

  // Add an effect to track analysis status with a timeout
  useEffect(() => {
    // If we're loading but not yet analyzed, set a timeout
    if (loading && !isAnalyzed && currentFile) {
      // Set a shorter timeout to ensure the UI doesn't get stuck
      const timer = setTimeout(() => {
        // Force showing the input field after timeout
        console.log('Analysis timeout reached, showing input field');
        setIsAnalyzed(true);
        
        // Also update loading message to inform user
        setLoadingMessage('Ready for naming');
      }, 5000); // Reduced to 5 seconds for better UX
      
      return () => clearTimeout(timer);
    }
  }, [loading, isAnalyzed, currentFile]);

  return (
    <div className="flex flex-col gap-6 h-full items-center justify-center text-center">
      <div
        {...getRootProps()}
        className={cn(
          "relative",
          "flex flex-col items-center justify-center gap-2 h-[128px] p-4 rounded-[6px] border border-dashed border-[#444444] text-center cursor-pointer",
          "transition-colors",
          "hover:border-[#C2F751]",
          isDragActive && 'border-[#C2F751] bg-[#C2F751]/5',
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
        {loading && !showSaveDialog && <LoadingOverlay message={loadingMessage} />}
      </div>

      <Button
        variant="primary"
        className={cn(
          "self-stretch"
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
          onClose={() => {
            setShowSaveDialog(false);
            setCurrentFile(null);
            setError(null);
            setIsAnalyzed(false);
          }}
          loadingMessage={loading && loadingMessage === 'Analyzing scene...' ? loadingMessage : undefined}
        />
      )}

      {showLibraryModal && (
        <LibraryModelPortal
          isOpen={showLibraryModal}
          onClose={() => setShowLibraryModal(false)}
          onSelect={handleLibrarySelect}
        />
      )}
    </div>
  );
}; 