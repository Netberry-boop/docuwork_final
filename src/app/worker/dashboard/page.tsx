"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiJson, apiData } from "@/lib/client";
import { useAuthStore } from "@/store/auth";
import AppShell from "@/components/shared/AppShell";
import { useRouter } from "next/navigation";
import { formatCurrency, STATUS_COLORS, PRIORITY_COLORS, formatDate } from "@/lib/utils";
import { CheckSquare, Clock, Play, DollarSign, Loader2, ArrowRight, FileText } from "lucide-react";

export default function WorkerDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["worker-dashboard"],
    queryFn: () => api.get("/analytics/dashboard").then(r => apiData<any>(r)),
  });

  const { data: tasksData } = useQuery({
    queryKey: ["worker-tasks-recent"],
    queryFn: () => api.get("/tasks?limit=5").then(r => apiJson<any>(r)),
  });

  const stats = [
    { label: "Total Tasks", value: data?.totalTasks || 0, icon: CheckSquare, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "In Progress", value: data?.inProgressTasks || 0, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Completed", value: data?.completedTasks || 0, icon: CheckSquare, color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Earnings", value: formatCurrency(data?.totalEarnings || 0), icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's your work summary</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Active tasks */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">My Tasks</h3>
            <button onClick={() => router.push("/worker/tasks")}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {tasksData?.data?.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No tasks assigned yet</p>
              </div>
            )}
            {tasksData?.data?.map((task: any) => (
              <div key={task.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{task.document?.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                    {task.status.replace("_", " ")}
                  </span>
                  {task.deadline && (
                    <span className="text-xs text-slate-400">{formatDate(task.deadline)}</span>
                  )}
                  {["ASSIGNED", "IN_PROGRESS", "REWORK_REQUIRED"].includes(task.status) && (
                    <button
                      onClick={() => router.push(`/worker/workspace/${task.id}`)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition">
                      <Play className="w-3 h-3" />
                      {task.status === "IN_PROGRESS" ? "Resume" : "Start"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
