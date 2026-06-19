"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiData } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const STATUS_COLORS_CHART: Record<string, string> = {
  ASSIGNED: "#94a3b8", IN_PROGRESS: "#3b82f6", SUBMITTED: "#f59e0b",
  UNDER_REVIEW: "#8b5cf6", APPROVED: "#10b981", REJECTED: "#ef4444",
  REWORK_REQUIRED: "#f97316", COMPLETED: "#059669",
};

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-report"],
    queryFn: () => api.get("/analytics/dashboard").then(r => apiData<any>(r)),
  });

  const { data: payments } = useQuery({
    queryKey: ["payments-report"],
    queryFn: () => api.get("/payments?limit=100").then(r => apiData<any>(r)),
  });

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
    </AppShell>
  );

  const pieData = Object.entries(data?.tasksByStatus || {})
    .filter(([, v]) => (v as number) > 0)
    .map(([name, value]) => ({ name, value: value as number }));

  const summaryStats = [
    { label: "Total Tasks", value: data?.totalTasks || 0 },
    { label: "Completed", value: data?.completedTasks || 0 },
    { label: "Completion Rate", value: data?.totalTasks ? `${Math.round((data.completedTasks / data.totalTasks) * 100)}%` : "0%" },
    { label: "Active Workers", value: data?.activeWorkers || 0 },
    { label: "Total Payout", value: formatCurrency(data?.totalPayout || 0) },
  ];

  // Group payments by worker for per-worker summary
  const workerEarnings: Record<string, { name: string; total: number; paid: number }> = {};
  (payments?.payments || []).forEach((p: any) => {
    if (!workerEarnings[p.worker.id]) {
      workerEarnings[p.worker.id] = { name: p.worker.name, total: 0, paid: 0 };
    }
    workerEarnings[p.worker.id].total += p.amount;
    if (p.isPaid) workerEarnings[p.worker.id].paid += p.amount;
  });

  const earningsData = Object.values(workerEarnings)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-0.5">Overview of platform performance</p>
          </div>
          <button
            onClick={() => {
              const rows = [
                ["Metric", "Value"],
                ...summaryStats.map(s => [s.label, String(s.value)])
              ];
              const csv = rows.map(r => r.join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob); a.download = "report.csv"; a.click();
            }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {summaryStats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Task status pie */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Task Status Breakdown</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={pieData} innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS_CHART[entry.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n.replace("_", " ")]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS_CHART[d.name] }} />
                    <span className="text-xs text-slate-600">{d.name.replace("_", " ")}</span>
                    <span className="text-xs font-semibold text-slate-800 ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Worker earnings */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Worker Earnings</h3>
            {earningsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={earningsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Earnings"]} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="paid" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Legend formatter={(v) => v === "total" ? "Total" : "Paid"} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No payment data</div>
            )}
          </div>
        </div>

        {/* Recent activity table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Task Activity</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.recentTasks || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No recent activity</div>
            ) : (
              data.recentTasks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.worker?.name || "Unassigned"}</p>
                  </div>
                  <span className="text-xs text-slate-400">{t.document.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
