import { Navigation } from "@/components/layout/Navigation";
// import { Sidebar } from "@/components/layout/Sidebar";
// import { Navbar } from "@/components/layout/Navbar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1">
        {children}
      </main>
      {/* <DevInfo /> */}
    </div>
  );
} 