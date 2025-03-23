import ViewerContainer from '@/components/viewer/ViewerContainer';

export default function ViewerPage() {
  return (
    <main className="flex flex-col w-full min-h-screen">
      {/* Main content area */}
      <div className="flex-1 relative">
        {/* Viewer canvas container - takes full height minus the header */}
        <div className="w-full h-[calc(100vh-4rem)] relative">
          <ViewerContainer />
        </div>
      </div>
    </main>
  );
} 