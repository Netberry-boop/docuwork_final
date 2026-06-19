"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/client";
import {
  LayoutDashboard, Users, CheckSquare, FileText,
  BarChart2, DollarSign, Settings, LogOut,
  Bell, ChevronDown, FileStack, Loader2, CheckCheck
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn, timeAgo } from "@/lib/utils";

const adminNav = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/workers", icon: Users, label: "Workers" },
  { href: "/admin/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/admin/documents", icon: FileStack, label: "Documents" },
  { href: "/admin/reports", icon: BarChart2, label: "Reports" },
  { href: "/admin/payments", icon: DollarSign, label: "Payments" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

const workerNav = [
  { href: "/worker/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/worker/tasks", icon: CheckSquare, label: "My Tasks" },
  { href: "/worker/earnings", icon: DollarSign, label: "Earnings" },
  { href: "/worker/profile", icon: Settings, label: "Profile" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, logout, accessToken, refreshToken, setAccessToken } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRefEl = useRef<HTMLDivElement>(null);

  // ── Auth guard + token hydration ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!user) {
        router.replace("/login");
        return;
      }

      // Role-based section guard
      const inAdminArea = pathname.startsWith("/admin");
      const inWorkerArea = pathname.startsWith("/worker");
      if (inAdminArea && user.role === "WORKER") {
        router.replace("/worker/dashboard");
        return;
      }
      if (inWorkerArea && user.role !== "WORKER") {
        router.replace("/admin/dashboard");
        return;
      }

      // If access token missing (e.g. after page reload), refresh it
      if (!accessToken && refreshToken) {
        try {
          const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          const json = await res.json();
          if (!cancelled) {
            if (json.success) setAccessToken(json.data.accessToken);
            else { logout(); router.replace("/login"); return; }
          }
        } catch {
          if (!cancelled) { logout(); router.replace("/login"); return; }
        }
      } else if (!accessToken && !refreshToken) {
        logout();
        router.replace("/login");
        return;
      }

      if (!cancelled) setReady(true);
    }

    hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userMenuRefEl.current && !userMenuRefEl.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAdmin = user?.role !== "WORKER";
  const nav = isAdmin ? adminNav : workerNav;

  // ── Notifications ─────────────────────────────────────────────
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications?limit=10").then(r => r.json()),
    enabled: ready,
    refetchInterval: 30_000,
  });

  const notifications: any[] = notifData?.data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  async function markAllRead() {
    await api.patch("/notifications");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleLogout() {
    const rt = useAuthStore.getState().refreshToken;
    await api.post("/auth/logout", { refreshToken: rt }).catch(() => {});
    logout();
    router.push("/login");
  }

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">DocuWork</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}>
                <item.icon className={cn("w-4 h-4", active ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200" ref={userMenuRefEl}>
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 transition">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.role?.replace("_", " ")}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-50">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-end px-6 gap-3 shrink-0">
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition">
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={cn("px-4 py-3 border-b border-slate-50 last:border-0", !n.isRead && "bg-blue-50/50")}>
                        <p className="text-sm font-medium text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
