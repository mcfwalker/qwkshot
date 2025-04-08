'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LockButton } from './LockButton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Wand2, Loader2, Lock } from 'lucide-react';

// Copied from CameraAnimationSystem - move to a shared types file?
type GeneratePathState = 'initial' | 'generating' | 'ready';
const generatePathStates: Record<GeneratePathState, { text: string; icon: React.ReactNode }> = {
  initial: { text: "Generate Path", icon: <Wand2 className="h-6 w-6" /> },
  generating: { text: "Generating...", icon: <Loader2 className="h-6 w-6 animate-spin" /> }, // Placeholder text
  ready: { text: "Ready!", icon: null }
};

export interface ShotCallerPanelProps { 
    isLocked: boolean;
    isGenerating: boolean;
    generatePathState: GeneratePathState; 
    instruction: string;
    inputDuration: string; 
    generatingMessage: string; 
    messageIndex: number; 
    onLockToggle: () => void;
    onInstructionChange: (value: string) => void;
    onDurationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDurationBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    onGeneratePath: () => void;
    isModelLoaded: boolean;
}

export const ShotCallerPanel: React.FC<ShotCallerPanelProps> = (props) => (
  <div>
    <div className="mb-6">
      <div>
        <div className="mb-4 flex w-8 h-8 px-2 py-0 flex-col justify-center items-center gap-2.5 aspect-square rounded-[20px] border border-[#444444] bg-[#1D1D1D] text-[#CFD0D0] text-xs font-normal">
          1
        </div>
        <LockButton 
          isLocked={props.isLocked} 
          onToggle={props.onLockToggle} 
          isModelLoaded={props.isModelLoaded}
        />
      </div>
    </div>
    <div className="space-y-4 mb-6">
      <div className="space-y-1">
        <div className="mb-4 flex w-8 h-8 px-2 py-0 flex-col justify-center items-center gap-2.5 aspect-square rounded-[20px] border border-[#444444] bg-[#1D1D1D] text-[#CFD0D0] text-xs font-normal">
          2
        </div>
        <div className="space-y-4">
          <Textarea
            placeholder="Describe what kind of shot you want to see..." 
            value={props.instruction}
            onChange={(e) => props.onInstructionChange(e.target.value)}
            disabled={!props.isLocked || props.isGenerating} 
            className="min-h-[128px] p-4 resize-none bg-[#121212] border-0 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/70 placeholder:text-sm rounded-xl"
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="duration-input" className="text-sm font-medium text-muted-foreground">Duration (20s max)</Label>
              <div className="w-16">
                <Input 
                  id="duration-input" type="number" value={props.inputDuration} 
                  onChange={props.onDurationChange} onBlur={props.onDurationBlur} 
                  min={1} max={20} step={0.5} 
                  className="text-right h-9 bg-[#121212] border-0 focus:ring-1 focus:ring-primary/50 text-sm rounded-lg"
                  disabled={!props.isLocked || props.isGenerating}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div>
      <motion.button 
        onClick={(e) => { e.preventDefault(); props.onGeneratePath(); }}
        disabled={!props.isLocked || props.isGenerating || props.generatePathState === 'ready'}
        className={cn(
            "w-full h-14 px-6 py-0 inline-flex items-center justify-center gap-2.5",
            "rounded-2xl border border-[#444444] bg-[#C2F751] text-black font-semibold text-sm",
            "shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)]",
            "hover:bg-[#C2F751]/90",
            (props.isGenerating || !props.isLocked || props.generatePathState === 'ready') && 
              "bg-[#2a2a2a] border border-[#555555] text-foreground hover:bg-[#2a2a2a]/90 cursor-default shadow-none"
        )}
        whileHover={(props.isGenerating || props.generatePathState === 'ready' || !props.isLocked) ? undefined : { scale: 1.02 }}
        whileTap={(props.isGenerating || props.generatePathState === 'ready' || !props.isLocked) ? undefined : { scale: 0.98 }}
      >
        <AnimatePresence mode="wait">
          <motion.div 
            key={props.isGenerating ? props.messageIndex : props.generatePathState} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.3 }} 
            className="flex items-center justify-center gap-2 w-full h-6"
          >
            {props.isGenerating ? 
              generatePathStates['generating'].icon 
              : (props.generatePathState === 'ready' ? null : <Wand2 className="h-4 w-4" />)
            }
            <span className="leading-none"> 
              {props.isGenerating ? props.generatingMessage : (props.generatePathState === 'ready' ? "Ready!" : "Generate Shot")}
            </span>
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  </div>
); 