"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiData, apiJson } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, formatDate, timeAgo, STATUS_COLORS, PRIORITY_COLORS } from "@/lib/utils";
import {
  Users, CheckSquare, Clock, DollarSign,
  FileText, Loader2, KeyRound, Copy
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardData {
  totalWorkers: number;
  activeWorkers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  submittedTasks: number;
  totalPayout: number;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    worker: { name: string } | null;
    document: { name: string };
  }>;
  tasksByStatus: Record<string, number>;
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface ResetRequest {
  id: string;
  name: string;
  email: string;
  role: string;
  expiresAt: string;
  resetLink: string;
}

function PasswordResetPanel() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["password-reset-requests"],
    queryFn: () => api.get("/auth/password-reset-requests").then(r => apiData<ResetRequest[]>(r)),
    enabled: user?.role === "SUPER_ADMIN",
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) =>
      api.patch("/auth/password-reset-requests", { userId }).then(r => apiJson<any>(r)),
    onSuccess: (json) => {
      setIssued({
        email: json.data.user.email,
        tempPassword: json.data.tempPassword,
      });
      qc.invalidateQueries({ queryKey: ["password-reset-requests"] });
    },
  });

  if (user?.role !== "SUPER_ADMIN") return null;

  const requests = data || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Password Reset Requests</h3>
          <p className="text-xs text-slate-400 mt-0.5">Copy a reset link or issue a temporary password.</p>
        </div>
        <KeyRound className="w-5 h-5 text-blue-500" />
      </div>

      {issued && (
        <div className="m-5 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Temporary password issued for {issued.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-sm text-slate-800 border border-green-100">
              {issued.tempPassword}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(issued.tempPassword)}
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-green-700 mt-2">Share it securely. The user should change it after login.</p>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {isLoading && (
          <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        )}
        {!isLoading && requests.length === 0 && (
          <div className="p-6 text-sm text-slate-400 text-center">No active reset requests</div>
        )}
        {requests.map((request) => (
          <div key={request.id} className="px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{request.name}</p>
              <p className="text-xs text-slate-400 truncate">{request.email} · {request.role.replace("_", " ")}</p>
              <p className="text-xs text-slate-400 mt-1">Expires {formatDate(request.expiresAt)}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(request.resetLink)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
            >
              <Copy className="w-3.5 h-3.5" /> Link
            </button>
            <button
              onClick={() => approveMutation.mutate(request.id)}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium"
            >
              {approveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Issue Temp Password
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () =>
      api.get("/analytics/dashboard").then((r) => apiData<DashboardData>(r)),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const stats = [
    {
      label: "Total Workers",
      value: data?.totalWorkers || 0,
      sub: `${data?.activeWorkers || 0} active`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Tasks",
      value: data?.totalTasks || 0,
      sub: `${data?.completedTasks || 0} completed`,
      icon: CheckSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "In Progress",
      value: data?.inProgressTasks || 0,
      sub: `${data?.submittedTasks || 0} pending review`,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Total Payout",
      value: formatCurrency(data?.totalPayout || 0),
      sub: "All time",
      icon: DollarSign,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const pieData = Object.entries(data?.tasksByStatus || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of your digitization operations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-slate-500">{s.label}</p>
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <PasswordResetPanel />

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Task Status Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Task Distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name.replace("_", " ")]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                No tasks yet
              </div>
            )}
          </div>

          {/* Bar chart placeholder */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Task Status Breakdown</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pieData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.replace("_", " ").slice(0, 8)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => [v, "Tasks"]} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                No data to display
              </div>
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Tasks</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {data?.recentTasks?.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">No tasks yet</div>
            )}
            {data?.recentTasks?.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {task.worker?.name || "Unassigned"} · {timeAgo(task.createdAt)}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || ""}`}>
                  {task.status.replace("_", " ")}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] || ""}`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
