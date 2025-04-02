import React from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';

interface StartPositionHintProps {
  visible: boolean;
}

export const StartPositionHint: React.FC<StartPositionHintProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-[110px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-[#0A0A0A]/90 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-lg"
    >
      <Camera className="w-4 h-4 text-zinc-400" />
      <span className="text-sm text-zinc-200">
        Press <kbd className="px-1.5 py-0.5 text-xs font-medium bg-[#0A0A0A] border border-zinc-800 rounded text-[#98C379]">S</kbd> to set camera start position
      </span>
    </motion.div>
  );
};

export default StartPositionHint; 