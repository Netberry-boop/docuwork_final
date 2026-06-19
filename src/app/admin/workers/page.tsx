"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { formatDate, timeAgo, cn } from "@/lib/utils";
import {
  Plus, Search, Loader2, UserCheck, UserX,
  MoreVertical, Mail, CheckCircle, XCircle, Eye
} from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Worker {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  avatar?: string;
  createdAt: string;
  _count: { assignedTasks: number; submissions: number };
}

function CreateWorkerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/workers", form);
      const json = await apiJson<any>(res);
      setCreated({ email: json.data.email, tempPassword: json.data.tempPassword });
      qc.invalidateQueries({ queryKey: ["workers"] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Add Worker</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        {created ? (
          <div className="p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-center font-semibold text-slate-900 mb-1">Worker created!</h3>
            <p className="text-center text-sm text-slate-500 mb-4">Share these credentials securely.</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm font-mono">
              <div><span className="text-slate-400">Email: </span><span className="text-slate-800">{created.email}</span></div>
              <div><span className="text-slate-400">Password: </span><span className="text-slate-800 font-bold">{created.tempPassword}</span></div>
            </div>
            <button onClick={onClose} className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Full Name</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ravi Kumar" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="worker@company.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password <span className="text-slate-400 font-normal">(optional — auto-generated if blank)</span></label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank to auto-generate" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Worker
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["workers", page, search, activeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (activeFilter === "active") params.set("isActive", "true");
      if (activeFilter === "inactive") params.set("isActive", "false");
      return api.get(`/workers?${params}`).then(r => apiJson<any>(r));
    },
    placeholderData: (prev: any) => prev,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/workers/${id}`, { isActive }).then(r => apiJson(r)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast("Worker status updated", "success");
    },
    onError: (e: any) => toast(e.message, "error"),
  });

  const workers: Worker[] = data?.data || [];

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Workers</h1>
            <p className="text-sm text-slate-500 mt-0.5">{data?.pagination?.total || 0} total workers</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" /> Add Worker
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-1.5">
            {(["all", "active", "inactive"] as const).map(f => (
              <button key={f} onClick={() => { setActiveFilter(f); setPage(1); }}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition",
                  activeFilter === f ? "bg-blue-600 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
                )}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-sm">No workers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {workers.map(w => (
              <div key={w.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{w.name}</p>
                    <p className="text-xs text-slate-400 truncate">{w.email}</p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                    w.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {w.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-slate-800">{w._count.assignedTasks}</p>
                    <p className="text-xs text-slate-400">Tasks</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-slate-800">{w._count.submissions}</p>
                    <p className="text-xs text-slate-400">Submissions</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-3">Joined {formatDate(w.createdAt)}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: w.id, isActive: !w.isActive })}
                    disabled={toggleMutation.isPending}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition",
                      w.isActive
                        ? "border border-red-200 text-red-600 hover:bg-red-50"
                        : "border border-green-200 text-green-600 hover:bg-green-50"
                    )}>
                    {w.isActive ? <><UserX className="w-3.5 h-3.5" /> Deactivate</> : <><UserCheck className="w-3.5 h-3.5" /> Activate</>}
                  </button>
                  <a href={`mailto:${w.email}`}
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition">
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data?.pagination?.pages > 1 && (
          <div className="flex justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50 transition">← Prev</button>
            <span className="px-4 py-2 text-sm text-slate-500">Page {page} of {data.pagination.pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50 transition">Next →</button>
          </div>
        )}
      </div>

      {showCreate && <CreateWorkerModal onClose={() => setShowCreate(false)} />}
    </AppShell>
  );
}
