'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
//import { LockButton } from './LockButton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from "@/components/ui/switch";
import { AppPanel } from "@/components/ui/AppPanel";

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

export const ShotCallerPanel: React.FC<ShotCallerPanelProps> = (props) => {
  const [isDurationOpen, setIsDurationOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex w-full justify-between items-center self-stretch">
        <Label className="text-sm font-medium text-foreground">
          {props.isLocked ? 'Camera is Locked' : 'Lock Start Position'}
        </Label>
        <div className="flex items-center justify-end min-w-[54px]">
          <Switch
            checked={props.isLocked}
            onCheckedChange={props.onLockToggle}
            disabled={!props.isModelLoaded || props.isGenerating}
            className={cn(
              "peer inline-flex h-6 w-[54px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors", 
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              "data-[state=checked]:bg-[#F76451]",    
              "data-[state=unchecked]:bg-[#CFD0D0]", 
              "[&>span]:pointer-events-none [&>span]:block [&>span]:h-5 [&>span]:w-5 [&>span]:rounded-full [&>span]:shadow-lg [&>span]:ring-0 [&>span]:transition-transform",
              "[&>span]:data-[state=checked]:translate-x-[28px]",
              "[&>span]:data-[state=unchecked]:translate-x-0",
              "data-[state=checked]:[&>span]:bg-[#121212]",     
              "data-[state=unchecked]:[&>span]:bg-[#121212]"
            )}
          />
        </div>
      </div>
      <div className="space-y-4 w-full">
        <div className="space-y-1">
          <div className="space-y-2">
            <Textarea
              placeholder="Describe what kind of shot you want to see..." 
              value={props.instruction}
              onChange={(e) => props.onInstructionChange(e.target.value)}
              disabled={!props.isLocked || props.isGenerating} 
              className={cn(
                "min-h-[128px] w-full p-4 resize-none bg-[#121212] border border-[#353535] focus:ring-1 focus:ring-primary/50 rounded-lg",
                "placeholder:text-muted-foreground/70 placeholder:text-sm",
                "text-foreground",
                "disabled:text-[#666666]",
                "disabled:placeholder:text-[#666666]"
              )}
            />
            <div className="flex justify-end items-center gap-2 self-stretch">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      type="button"
                      onClick={() => setIsDurationOpen(!isDurationOpen)}
                      className={`
                        w-8 h-8 flex items-center justify-center p-0 border-0 bg-transparent
                        ${isDurationOpen ? 'text-[#C2F751]' : 'text-muted-foreground'}
                        ${!props.isLocked || props.isGenerating 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:text-[#C2F751] cursor-pointer'}
                      `}
                      disabled={!props.isLocked || props.isGenerating} 
                    >
                      <Clock size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[#121212] border-none text-white">
                    Toggle duration input
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {isDurationOpen && (
            <motion.div 
              key="duration-section"
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              transition={{ duration: 0.2 }}
              className="overflow-hidden w-full"
            >
              <div className="pt-2 space-y-1"> 
                <div className="flex items-center justify-between">
                  <Label htmlFor="duration-input" className="text-sm font-medium text-muted-foreground">Fixed Duration (20s max)</Label>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="w-full">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild className="w-full">
              <Button 
                variant="primary"
                size="xl"
                onClick={(e) => { e.preventDefault(); props.onGeneratePath(); }}
                disabled={!props.isModelLoaded || !props.isLocked || props.isGenerating || props.generatePathState === 'ready'}
                className="w-full"
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
              </Button>
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
}; 