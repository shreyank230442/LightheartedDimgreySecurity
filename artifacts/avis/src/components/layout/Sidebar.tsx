import { Link, useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  FileText,
  Images,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Target,
  Upload,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/upload", icon: Upload, label: "Upload Center" },
  { href: "/pipeline", icon: Activity, label: "Processing Pipeline" },
  { href: "/detections", icon: Target, label: "Detections" },
  { href: "/timeline", icon: AlertTriangle, label: "Incident Timeline" },
  { href: "/evidence", icon: Images, label: "Evidence Gallery" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/chat", icon: MessageSquare, label: "AI Assistant" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Video className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">AVIS SOC</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary/10 text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-border p-4">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50">
            <span className="text-xs font-bold text-primary">OP</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-sidebar-foreground">Operator 1</p>
            <p className="text-xs text-sidebar-foreground/50">Active Session</p>
          </div>
        </div>
      </div>
    </div>
  );
}
