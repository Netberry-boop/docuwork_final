"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { STATUS_COLORS, PRIORITY_COLORS, formatDate, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  FileText, Clock, Calendar, DollarSign,
  Play, Loader2, Search
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  deadline?: string;
  paymentAmount: number;
  document: { name: string; fileType: string };
  estimatedPages?: number;
  createdAt: string;
}

export default function WorkerTasksPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      return api.get(`/tasks?${params}`).then(r => apiJson<{ data: Task[] }>(r));
    },
  });

  const tabs = ["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"];

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.data?.length || 0} tasks assigned to you
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          </div>
        )}

        {!isLoading && data?.data?.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No tasks found</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.data?.map(task => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-700 transition">
                  {task.title}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </span>
              </div>

              {/* Document */}
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 truncate">{task.document.name}</span>
              </div>

              {task.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{task.description}</p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                {task.deadline && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(task.deadline)}
                  </span>
                )}
                {task.estimatedPages && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {task.estimatedPages} pages
                  </span>
                )}
                {task.paymentAmount > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ₹{task.paymentAmount}
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                  {task.status.replace("_", " ")}
                </span>

                {["ASSIGNED", "IN_PROGRESS", "REWORK_REQUIRED"].includes(task.status) && (
                  <button
                    onClick={() => router.push(`/worker/workspace/${task.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
                  >
                    <Play className="w-3 h-3" />
                    {task.status === "IN_PROGRESS" ? "Continue" : "Start"}
                  </button>
                )}

                {task.status === "SUBMITTED" && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Under review
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
