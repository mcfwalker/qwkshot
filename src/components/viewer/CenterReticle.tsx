'use client';

import { useViewerStore } from '@/store/viewerStore';
import { cn } from '@/lib/utils';
// No R3F or Three.js imports needed

// No props needed

export function CenterReticle() {
  const isLocked = useViewerStore((state) => state.isLocked);

  // Base styles for the overlay container - Revert to absolute screen centering
  const baseContainerClasses =
    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center justify-center';

  // Define colors
  const lockedColor = '#F76451';
  const unlockedColor = '#C2F751';
  const circleFillColor = '#4B4B4B';
  const textColor = '#A0A0A0';

  // Determine current color based on state
  const currentReticleColor = isLocked ? lockedColor : unlockedColor;

  return (
    <div className={cn(baseContainerClasses)}>
      {/* SVG Container */}
      <svg
        width="176"
        height="176"
        viewBox="10 10 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Center Circle & Plus */}
        <circle cx="50" cy="50" r="14" fill={circleFillColor} fillOpacity="0.25" />
        <line x1="50" y1="45" x2="50" y2="55" stroke={currentReticleColor} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="45" y1="50" x2="55" y2="50" stroke={currentReticleColor} strokeWidth="1.5" strokeLinecap="round" />

        {/* Corner Brackets */}
        <polyline points="15,25 15,15 25,15" stroke={currentReticleColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="75,15 85,15 85,25" stroke={currentReticleColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="25,85 15,85 15,75" stroke={currentReticleColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="85,75 85,85 75,85" stroke={currentReticleColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Text labels */}
      <div className="mt-2">
        {isLocked && (
          <span
            className="text-xs font-medium uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ color: textColor, backgroundColor: 'rgba(18, 18, 18, 0.75)' }}
          >
            camera locked
          </span>
        )}
        {!isLocked && (
          <span
            className="text-xs font-medium uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap"
            style={{ color: textColor, backgroundColor: 'rgba(18, 18, 18, 0.75)' }}
          >
            camera start position
          </span>
        )}
      </div>
    </div>
  );
} 