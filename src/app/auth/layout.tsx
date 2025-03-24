export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-sm">
          {children}
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 h-full bg-zinc-900">
          <div className="flex h-full flex-col justify-between p-8">
            <div className="relative z-20">
              <h1 className="text-2xl font-bold text-white">Modern 3D Viewer</h1>
            </div>
            <div className="relative z-20">
              <p className="text-lg text-white/80">
                A powerful web-based 3D model viewer with AI-powered camera path generation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 