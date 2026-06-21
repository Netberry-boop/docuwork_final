"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { toast } from "@/components/ui/toaster";
import { Loader2, FilePlus, CheckCircle, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

function fieldClass() {
  return "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
}

export default function AdminProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    documentIds: [] as string[],
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      const res = await api.get(`/projects?${params}`);
      return apiJson<any>(res);
    },
  });

  const { data: docsData } = useQuery({
    queryKey: ["documents", "for-project"],
    queryFn: async () => {
      const res = await api.get("/documents?limit=200");
      return apiJson<any>(res);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/projects", {
        title: form.title,
        description: form.description || undefined,
        documentIds: form.documentIds,
      });
      return apiJson<any>(res);
    },
    onSuccess: () => {
      toast("Project created", "success");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setForm({ title: "", description: "", documentIds: [] });
      setError("");
    },
    onError: (err: any) => {
      setError(err?.message || "Unable to create project");
    },
  });

  const projects = data?.data ?? [];
  const documents = [...(docsData?.data ?? [])].sort((a: any, b: any) =>
    new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(
      a.name || a.originalName || "",
      b.name || b.originalName || ""
    )
  );
  function toggleDocument(id: string) {
    setForm(current => {
      const has = current.documentIds.includes(id);
      if (!has && current.documentIds.length >= 200) {
        setError("A project can include up to 200 documents.");
        return current;
      }
      const next = has ? current.documentIds.filter(docId => docId !== id) : [...current.documentIds, id];
      if (next.length <= 200) setError("");
      return { ...current, documentIds: next };
    });
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">Create document projects first, then assign them from Tasks.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full sm:w-64 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowCreate(prev => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              <FilePlus className="w-4 h-4" />
              {showCreate ? "Hide" : "New Project"}
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Create a Project</h2>
              <span className="text-xs text-slate-500">Choose up to 200 documents</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Title *</label>
                  <input
                    required
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className={fieldClass()}
                    placeholder="Project title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className={fieldClass() + " resize-none h-24"}
                    placeholder="Optional project notes"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Documents</label>
                    <p className="text-xs text-slate-400">Select documents for this project.</p>
                  </div>
                  <span className="text-xs text-slate-500">{form.documentIds.length} selected</span>
                </div>
                <div className="h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {documents.length === 0 ? (
                    <p className="text-sm text-slate-400">No documents available.</p>
                  ) : (
                    <div className="grid gap-2">
                      {documents.slice(0, 200).map((doc: any, index: number) => {
                        const checked = form.documentIds.includes(doc.id);
                        const disabled = !checked && form.documentIds.length >= 200;
                        return (
                        <label key={doc.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:border-blue-300 transition">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleDocument(doc.id)}
                            className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                          />
                          <span className="w-8 shrink-0 text-right text-xs font-mono text-slate-400">{index + 1}</span>
                          <div className="min-w-0 text-sm">
                            <p className="font-medium text-slate-900 truncate">{doc.name}</p>
                            <p className="text-xs text-slate-400">Uploaded by {doc.uploadedBy?.name ?? "you"}</p>
                          </div>
                        </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !form.title.trim() || form.documentIds.length === 0}
                onClick={async () => {
                  if (!form.title.trim() || form.documentIds.length === 0) {
                    setError("Project must include a title and at least one document.");
                    return;
                  }
                  setError("");
                  setSubmitting(true);
                  try {
                    await createMutation.mutateAsync();
                    setShowCreate(false);
                  } catch (_) {
                    // error handled by mutation
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Create Project
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Project List</h2>
              <p className="text-sm text-slate-500">{projects.length} projects</p>
            </div>
            <div className="text-xs text-slate-500">Showing latest projects</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Assigned Users</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Tasks</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">No projects found.</td>
                  </tr>
                ) : (
                  projects.map((project: any) => (
                    <tr key={project.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{project.title}</div>
                        <div className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description || "—"}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {project._count?.assignments ? `${project._count.assignments} users` : "Unassigned"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{project._count?.documents ?? 0}</td>
                      <td className="px-4 py-4 text-slate-600">{project._count?.tasks ?? 0}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(project.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
