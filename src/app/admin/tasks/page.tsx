"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { STATUS_COLORS, PRIORITY_COLORS, formatDate, cn } from "@/lib/utils";
import {
  Plus, Search, Loader2, FileText, Trash2, Eye,
  CheckCircle, XCircle, RotateCcw, Star
} from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  deadline?: string;
  paymentAmount: number;
  worker?: { id: string; name: string };
  document: { id: string; name: string; storageUrl: string; fileType: string };
  project?: { id: string; title: string };
  pageNumber?: number;
  createdAt: string;
  _count: { submissions: number };
  submissions?: Array<{
    id: string; version: number; content: string; wordCount: number;
    charCount: number; timeSpentSec: number; isDraft: boolean; createdAt: string;
    worker: { id: string; name: string };
    review?: { status: string; comments?: string; accuracyScore?: number; reviewer: { name: string } };
  }>;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────────────
function CreateTaskModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: "", description: "", priority: "MEDIUM",
    deadline: "", paymentAmount: 0, documentId: "", projectId: "", workerId: "",
    instructions: "", estimatedPages: 0, pageNumber: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: docsRes } = useQuery({
    queryKey: ["docs-select"],
    queryFn: () => api.get("/documents?limit=100").then(r => apiJson<any>(r)),
  });
  const { data: workersRes } = useQuery({
    queryKey: ["workers-select"],
    queryFn: () => api.get("/workers?limit=100").then(r => apiJson<any>(r)),
  });
  const { data: projectsRes } = useQuery({
    queryKey: ["projects-select"],
    queryFn: () => api.get("/projects?limit=100").then(r => apiJson<any>(r)),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await api.post("/tasks", {
        ...form,
        paymentAmount: Number(form.paymentAmount),
        estimatedPages: Number(form.estimatedPages) || undefined,
        projectId: form.projectId || undefined,
        pageNumber: form.pageNumber > 0 ? Number(form.pageNumber) : undefined,
        workerId: form.workerId || undefined,
        deadline: form.deadline || undefined,
      });
      const json = await apiJson<any>(res);
      if (!json.success) throw new Error(json.error);
      onSuccess(); onClose();
      toast("Task created", "success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Create Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[76vh] overflow-y-auto">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <Field label="Title *">
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={inputCls} placeholder="e.g. Digitize 1947 Land Records" />
          </Field>
          <Field label="Document *">
            <select required value={form.documentId}
              onChange={e => setForm(f => ({ ...f, documentId: e.target.value }))} className={inputCls}>
              <option value="">Select document…</option>
              {docsRes?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Project">
            <select value={form.projectId}
              onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inputCls}>
              <option value="">No project</option>
              {projectsRes?.data?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.worker ? ` — ${p.worker.name}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Page number">
            <input type="number" min={1} value={form.pageNumber}
              onChange={e => setForm(f => ({ ...f, pageNumber: Number(e.target.value) }))}
              className={inputCls} placeholder="Optional page order" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Deadline">
              <input type="date" value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment (₹)">
              <input type="number" min={0} value={form.paymentAmount}
                onChange={e => setForm(f => ({ ...f, paymentAmount: Number(e.target.value) }))} className={inputCls} />
            </Field>
            <Field label="Est. Pages">
              <input type="number" min={0} value={form.estimatedPages}
                onChange={e => setForm(f => ({ ...f, estimatedPages: Number(e.target.value) }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Assign to Worker">
            <select value={form.workerId} onChange={e => setForm(f => ({ ...f, workerId: e.target.value }))} className={inputCls}>
              <option value="">Unassigned</option>
              {workersRes?.data?.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.email})</option>)}
            </select>
          </Field>
          <Field label="Instructions">
            <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              rows={3} className={`${inputCls} resize-none`}
              placeholder="Special instructions for the worker…" />
          </Field>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ task, onClose, onSuccess }: { task: Task; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState<"APPROVED" | "REJECTED" | "REWORK_REQUIRED">("APPROVED");
  const [comments, setComments] = useState("");
  const [score, setScore] = useState<number | "">(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latest = task.submissions?.[0];
  const timeStr = latest ? `${Math.floor((latest.timeSpentSec || 0) / 60)}m ${(latest.timeSpentSec || 0) % 60}s` : "—";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await api.post(`/tasks/${task.id}/review`, {
        status,
        comments: comments || undefined,
        accuracyScore: score !== "" ? Number(score) : undefined,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast(
        status === "APPROVED" ? "Task approved ✓" : status === "REJECTED" ? "Task rejected" : "Rework requested",
        status === "APPROVED" ? "success" : "info"
      );
      onSuccess(); onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">Review Submission</h2>
            <p className="text-xs text-slate-400 mt-0.5">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Split: doc + submission */}
          <div className="grid grid-cols-2 divide-x divide-slate-200" style={{ minHeight: 320 }}>
            {/* Document */}
            <div className="p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Source Document</p>
              {task.document?.storageUrl ? (
                task.document.fileType?.includes("pdf") ? (
                  <iframe src={task.document.storageUrl} className="w-full rounded border border-slate-200 bg-white"
                    style={{ height: 300 }} title="doc" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={task.document.storageUrl} alt="doc"
                    className="w-full rounded border border-slate-200 object-contain bg-white" style={{ maxHeight: 300 }} />
                )
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No preview</div>
              )}
            </div>
            {/* Submission */}
            <div className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Worker Submission</p>
                {latest && (
                  <span className="text-xs text-slate-400">
                    v{latest.version} · {latest.wordCount}w · {timeStr}
                  </span>
                )}
              </div>
              {latest ? (
                <textarea readOnly value={latest.content}
                  className="flex-1 w-full p-3 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg resize-none leading-relaxed text-slate-700"
                  style={{ minHeight: 260 }} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No submission yet</div>
              )}
            </div>
          </div>

          {/* Review form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 border-t border-slate-200">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

            {/* Decision buttons */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Decision</p>
              <div className="flex gap-2">
                {([
                  { v: "APPROVED", icon: CheckCircle, label: "Approve", active: "bg-green-600 text-white border-green-600", idle: "border-slate-300 text-slate-600 hover:border-green-400 hover:text-green-600" },
                  { v: "REWORK_REQUIRED", icon: RotateCcw, label: "Rework", active: "bg-orange-500 text-white border-orange-500", idle: "border-slate-300 text-slate-600 hover:border-orange-400 hover:text-orange-600" },
                  { v: "REJECTED", icon: XCircle, label: "Reject", active: "bg-red-600 text-white border-red-600", idle: "border-slate-300 text-slate-600 hover:border-red-400 hover:text-red-600" },
                ] as const).map(btn => (
                  <button key={btn.v} type="button" onClick={() => setStatus(btn.v)}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition",
                      status === btn.v ? btn.active : btn.idle)}>
                    <btn.icon className="w-4 h-4" />{btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-700">Comments</label>
                <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3}
                  placeholder="Feedback for the worker…"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Accuracy %</label>
                <input type="number" min={0} max={100} value={score}
                  onChange={e => setScore(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={loading || !latest}
                className={cn("flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50",
                  status === "APPROVED" ? "bg-green-600 hover:bg-green-700" :
                  status === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600")}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Review
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await api.get(`/tasks?${params}`);
      return apiJson<any>(res);
    },
    placeholderData: (prev: any) => prev,
  });

  // Fetch full task detail for review (includes submissions)
  const openReview = async (taskId: string) => {
    const res = await api.get(`/tasks/${taskId}`);
    const json = await apiJson<any>(res);
    setReviewTask(json.data);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`).then(r => apiJson(r)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast("Task deleted", "info"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const tasks: Task[] = data?.data ?? [];
  const pagination = data?.pagination;

  const filterTabs = ["ALL", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "REWORK_REQUIRED"];

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
            <p className="text-sm text-slate-500 mt-0.5">{pagination?.total ?? 0} total tasks</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tasks…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {filterTabs.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  statusFilter === s ? "bg-blue-600 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
                )}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Task", "Worker", "Project", "Status", "Priority", "Deadline", "Payment", "Actions"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr><td colSpan={8} className="text-center py-12">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                  </td></tr>
                )}
                {!isLoading && tasks.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No tasks found</td></tr>
                )}
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">{task.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{task.document.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {task.worker?.name ?? <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {task.project ? <span className="text-slate-700">{task.project.title}</span> : <span className="text-slate-400">No project</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? ""}`}>
                        {task.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {task.deadline ? formatDate(task.deadline) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">₹{task.paymentAmount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {["SUBMITTED", "UNDER_REVIEW"].includes(task.status) && (
                          <button onClick={() => openReview(task.id)}
                            className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-xs font-medium transition flex items-center gap-1">
                            <Star className="w-3 h-3" /> Review
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm("Delete this task?")) deleteMutation.mutate(task.id); }}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.pages}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
        />
      )}
      {reviewTask && (
        <ReviewModal
          task={reviewTask}
          onClose={() => setReviewTask(null)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["tasks"] }); setReviewTask(null); }}
        />
      )}
    </AppShell>
  );
}
