'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
//import { LockButton } from './LockButton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Wand2, Loader2, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from "@/components/ui/switch";

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
  <div className="flex flex-col gap-6 p-0 bg-[#1D1D1D] rounded-xl w-[256px]">
    <div className="flex w-full px-4 h-14 justify-between items-center self-stretch rounded-lg bg-[#121212] border border-[#353535]">
      <Label className="text-sm font-medium text-foreground">
        {props.isLocked ? 'Camera is Locked' : 'Lock Start Position'}
      </Label>
      <div className="w-16">
        <Switch
          checked={props.isLocked}
          onCheckedChange={props.onLockToggle}
          disabled={!props.isModelLoaded || props.isGenerating}
          className={cn(
            // Base & Size/Shape
            "peer inline-flex h-6 w-[54px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors", 
            // Focus/Disabled
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            // Track Colors (Locked/Checked = Red, Unlocked/Unchecked = Light Grey)
            "data-[state=checked]:bg-[#F76451]",    
            "data-[state=unchecked]:bg-[#CFD0D0]", 
            // Thumb Base Styles
            "[&>span]:pointer-events-none [&>span]:block [&>span]:h-5 [&>span]:w-5 [&>span]:rounded-full [&>span]:shadow-lg [&>span]:ring-0 [&>span]:transition-transform",
            // Thumb Position
            "[&>span]:data-[state=checked]:translate-x-[28px]", // Adjust translation for new width (54px - 20px thumb = 34px total move space? try 28px)
            "[&>span]:data-[state=unchecked]:translate-x-0",
            // Thumb Colors (Locked/Checked = Dark Grey/Panel, Unlocked/Unchecked = Medium Grey)
            "data-[state=checked]:[&>span]:bg-[#1D1D1D]",     
            "data-[state=unchecked]:[&>span]:bg-[#353535]" 
          )}
        />
      </div>
    </div>
    <div className="space-y-4 mb-6">
      <div className="space-y-1">
        <div className="space-y-4">
          <Textarea
            placeholder="Describe what kind of shot you want to see..." 
            value={props.instruction}
            onChange={(e) => props.onInstructionChange(e.target.value)}
            disabled={!props.isLocked || props.isGenerating} 
            className={cn(
              "min-h-[128px] w-full p-4 resize-none bg-[#121212] border-0 focus:ring-1 focus:ring-primary/50 rounded-xl",
              "placeholder:text-muted-foreground/70 placeholder:text-sm",
              "text-foreground",
              "disabled:text-[#666666]",
              "disabled:placeholder:text-[#666666]"
            )}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="duration-input" className="text-sm font-medium text-muted-foreground">Duration (20s max)</Label>
              <div className="w-16">
                <Input 
                  id="duration-input" type="number" value={props.inputDuration} 
                  onChange={props.onDurationChange} onBlur={props.onDurationBlur} 
                  min={1} max={20} step={0.5} 
                  className="text-right h-9 bg-[#121212] border-0 focus:ring-1 focus:ring-primary/50 text-sm rounded-lg disabled:text-[#666666]"
                  disabled={!props.isLocked || props.isGenerating}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="w-full">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild className="w-full">
            <motion.button 
              onClick={(e) => { e.preventDefault(); props.onGeneratePath(); }}
              disabled={!props.isModelLoaded || !props.isLocked || props.isGenerating || props.generatePathState === 'ready'}
              className={cn(
                  "w-full h-14 px-6 py-0 inline-flex items-center justify-center gap-2.5",
                  "rounded-2xl border border-[#444444]",
                  "shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)]",
                  "font-semibold text-sm",
                  (props.isGenerating || !props.isModelLoaded || !props.isLocked || props.generatePathState === 'ready')
                    ? "bg-[#444444] text-[#666666] shadow-none"
                    : "bg-[#C2F751] text-black hover:bg-[#C2F751]/90"
              )}
              whileHover={(props.isGenerating || props.generatePathState === 'ready' || !props.isLocked || !props.isModelLoaded) ? undefined : { /* scale removed */ }}
              whileTap={(props.isGenerating || props.generatePathState === 'ready' || !props.isLocked || !props.isModelLoaded) ? undefined : { scale: 0.98 }}
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
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="bg-[#121212] border-none text-white"
          >
            {!props.isModelLoaded
              ? 'Load a model first.'
              : !props.isLocked
                ? 'Camera must be locked.'
                : props.isGenerating
                  ? 'Generation in progress...'
                  : props.generatePathState === 'ready'
                    ? 'Path is ready, go to Playback tab'
                    : 'Generate camera path based on description'
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
); 