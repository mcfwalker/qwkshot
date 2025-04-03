'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Object3D, PerspectiveCamera } from 'three';

interface StartPositionHintProps {
  visible: boolean;
  modelId?: string;
  modelRef?: React.RefObject<Object3D | null>;
  cameraRef?: React.RefObject<PerspectiveCamera>;
  controlsRef?: React.RefObject<any>;
}

export const StartPositionHint = ({ 
  visible, 
  modelId,
  modelRef,
  cameraRef,
  controlsRef 
}: StartPositionHintProps) => {
  const { isLocked, toggleLock, storeEnvironmentalMetadata } = useViewerStore();

  const handleKeyPress = async (event: KeyboardEvent) => {
    if (event.key === 's') {
      try {
        // Only attempt to store metadata when locking and if we have all required refs
        if (!isLocked && modelId && modelRef?.current && cameraRef?.current && controlsRef?.current) {
          await storeEnvironmentalMetadata(
            modelId,
            modelRef.current,
            cameraRef.current,
            controlsRef.current
          );
          toast.success('Scene composition locked and saved');
        }
        toggleLock();
      } catch (error) {
        console.error('Failed to store environmental metadata:', error);
        toast.error('Failed to store scene composition');
      }
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLocked, modelId, modelRef, cameraRef, controlsRef]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        'absolute top-4 left-1/2 transform -translate-x-1/2',
        'bg-background/95 backdrop-blur-md',
        'border border-[#444444] rounded shadow-lg',
        'px-4 py-2 text-sm text-muted-foreground',
        'transition-all duration-200',
        'hover:border-[#555555] hover:shadow-xl',
        'hover:bg-background/98'
      )}
    >
      Press 's' to {isLocked ? 'unlock' : 'lock'} camera and composition
    </motion.div>
  );
};

export default StartPositionHint; 