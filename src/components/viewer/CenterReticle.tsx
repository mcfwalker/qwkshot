'use client';

import { useViewerStore } from '@/store/viewerStore';
import { cn } from '@/lib/utils';

export function CenterReticle() {
  const isLocked = useViewerStore((state) => state.isLocked);
  console.log('[CenterReticle] Rendering - isLocked:', isLocked); // Log the state

  // Base styles for the overlay container
  const baseContainerClasses = 
    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center justify-center'; // Restored justify-center

  // Define colors
  const lockedColor = '#F76451'; // Red/orange for locked
  const unlockedColor = '#C2F751'; // Accent green for unlocked
  const circleFillColor = '#4B4B4B';
  const textColor = '#A0A0A0';

  // Determine current color based on state
  const currentReticleColor = isLocked ? lockedColor : unlockedColor;

  return (
    <div className={cn(baseContainerClasses)}> {/* Removed gap-* */} 
      {/* SVG Container - adjust size as needed */} 
      <svg 
        width="176" // Adjusted size to match tighter viewBox
        height="176"
        viewBox="10 10 80 80" // Tighter viewBox around content (10,10 to 90,90)
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Center Circle - Unchanged for now, but we might want to revisit its color if it clashes */}
        <circle cx="50" cy="50" r="14" fill={circleFillColor} fillOpacity="0.25" />

        {/* Center Plus - Outline Layer */}
        <line x1="50" y1="45" x2="50" y2="55" stroke="#e2e2e2" strokeWidth="5.5" strokeLinecap="square" />
        <line x1="45" y1="50" x2="55" y2="50" stroke="#e2e2e2" strokeWidth="5.5" strokeLinecap="square" />
        {/* Center Plus - Inner Layer */}
        <line x1="50" y1="45" x2="50" y2="55" stroke="#121212" strokeWidth="1.5" strokeLinecap="square" />
        <line x1="45" y1="50" x2="55" y2="50" stroke="#121212" strokeWidth="1.5" strokeLinecap="square" />
        
        {/* Corner Brackets (L-shapes) */}
        {/* Top Left Outline */}
        <polyline points="15,25 15,15 25,15" stroke="#e2e2e2" strokeWidth="5.5" strokeLinecap="square" strokeLinejoin="miter" />
        {/* Top Left Notch */}
        <polyline points="15,25 15,15 25,15" stroke="#121212" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
        
        {/* Top Right Outline */}
        <polyline points="75,15 85,15 85,25" stroke="#e2e2e2" strokeWidth="5.5" strokeLinecap="square" strokeLinejoin="miter" />
        {/* Top Right Notch */}
        <polyline points="75,15 85,15 85,25" stroke="#121212" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
        
        {/* Bottom Left Outline */}
        <polyline points="25,85 15,85 15,75" stroke="#e2e2e2" strokeWidth="5.5" strokeLinecap="square" strokeLinejoin="miter" />
        {/* Bottom Left Notch */}
        <polyline points="25,85 15,85 15,75" stroke="#121212" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
        
        {/* Bottom Right Outline */}
        <polyline points="85,75 85,85 75,85" stroke="#e2e2e2" strokeWidth="5.5" strokeLinecap="square" strokeLinejoin="miter" />
        {/* Bottom Right Notch */}
        <polyline points="85,75 85,85 75,85" stroke="#121212" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>

      {/* Wrapper for text labels with margin-top */}
      <div className="mt-2"> {/* Reduced margin-top for tighter spacing */} 
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
            className="text-xs font-medium uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ color: textColor, backgroundColor: 'rgba(18, 18, 18, 0.75)' }}
          >
            camera start position
          </span>
        )}
      </div>
    </div>
  );
} 