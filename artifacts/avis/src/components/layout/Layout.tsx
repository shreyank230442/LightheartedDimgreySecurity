import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Agentic Visual Incident Investigation System
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safe opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-safe"></span>
              </span>
              <span className="text-xs font-mono text-safe">SYS.ONLINE</span>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <span className="text-xs font-mono text-muted-foreground">
              {new Date().toISOString().split("T")[0]}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
