import { AtlasSidebar } from './AtlasSidebar';
import { AtlasTopbar } from './AtlasTopbar';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <AtlasTopbar />
      <AtlasSidebar />
      <main className="min-h-screen pt-16 lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
