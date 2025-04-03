import { Button } from '@/components/ui/button';
import { Lock, Unlock } from 'lucide-react';
import { useViewerStore } from '@/store/viewerStore';
import { toast } from 'sonner';

export const LockButton = () => {
  const { isLocked, toggleLock } = useViewerStore();

  const handleLockToggle = () => {
    toggleLock();
    toast.success(isLocked ? 'Viewer unlocked' : 'Viewer locked');
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className="viewer-button"
      onClick={handleLockToggle}
      aria-label={isLocked ? 'Unlock viewer' : 'Lock viewer'}
    >
      {isLocked ? (
        <Lock className="viewer-button-icon" />
      ) : (
        <Unlock className="viewer-button-icon" />
      )}
    </Button>
  );
}; 