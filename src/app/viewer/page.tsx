import { Suspense } from 'react';
import { ViewerContainer } from '@/components/viewer/ViewerContainer';
import { ViewerLoadingSkeleton } from '@/components/shared/LoadingStates';

export default function ViewerPage() {
  return (
    <Suspense fallback={<ViewerLoadingSkeleton />}>
      <ViewerContainer />
    </Suspense>
  );
} 