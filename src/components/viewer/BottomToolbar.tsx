'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Target, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// STEP 1: Only props for Reset button
interface BottomToolbarProps {
  onToggleReticle?: () => void;
  isReticleVisible?: boolean;
  isReticleLoading?: boolean;
  onClearStageReset: () => void;
  isConfirmingReset: boolean;
}

const BottomToolbarComponent: React.FC<BottomToolbarProps> = ({
  onToggleReticle,
  isReticleVisible = true,
  isReticleLoading = false,
  onClearStageReset,
  isConfirmingReset,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2 p-2 rounded-full bg-[#121212] border border-[#444]">
      
      {/* Reticle Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-full hover:bg-foreground/10", // Base styles
          // Use actual visibility state for styling
          isReticleVisible 
            ? "text-[#C2F751] hover:text-[#C2F751]/80 bg-foreground/10" // Active state
            : "text-foreground/60 hover:text-foreground", // Inactive state
          isReticleLoading && "opacity-50 cursor-not-allowed" // Loading style
        )}
        onClick={onToggleReticle} // Use actual handler prop
        aria-label="Toggle Reticle" // Update label
        disabled={isReticleLoading} // Use loading state prop
      >
        {isReticleLoading 
          ? <Loader2 className="h-4 w-4 animate-spin" /> 
          : <Target className={cn("h-4 w-4")} />
        }
      </Button>

      {/* Separator (Restore if desired) */}
      <div className="h-6 w-px bg-[#444] mx-1"></div>

      {/* Clear Stage / Reset Button (Uses real props) */}
       <Button
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-8 w-8 rounded-full text-foreground/60 hover:text-red-500/80 hover:bg-red-500/10",
              isConfirmingReset && "bg-red-500/20 text-red-500"
            )}
            onClick={onClearStageReset} // Use real prop
            aria-label={isConfirmingReset ? "Confirm Reset Stage" : "Clear Stage & Reset"}
          >
            <Trash2 className="h-4 w-4" />
       </Button>
    </div>
  );
};

export const BottomToolbar = React.memo(BottomToolbarComponent); 