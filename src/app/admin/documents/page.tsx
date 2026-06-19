"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { formatDate, cn } from "@/lib/utils";
import {
  Upload, FileText, FileScan, Image, File,
  Trash2, Loader2, Search, CheckCircle, AlertCircle, X
} from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Document {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  storageUrl: string;
  pageCount?: number;
  createdAt: string;
  _count: { tasks: number };
}

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type.includes("pdf")) return <FileScan className="w-5 h-5 text-red-500" />;
  if (type.includes("image")) return <Image className="w-5 h-5 text-blue-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<{ file: File; name: string; status: "pending" | "uploading" | "done" | "error"; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const valid = Array.from(incoming)
      .filter(f => ALLOWED.includes(f.type))
      .map(f => ({ file: f, name: f.name.replace(/\.[^.]+$/, ""), status: "pending" as const }));
    setFiles(prev => [...prev, ...valid]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function uploadAll() {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));
      try {
        const fd = new FormData();
        fd.append("file", files[i].file);
        fd.append("name", files[i].name);
        const res = await api.upload("/documents", fd);
        await apiJson(res);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
      } catch (err: any) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", error: err.message } : f));
      }
    }
    qc.invalidateQueries({ queryKey: ["documents"] });
  }

  const hasPending = files.some(f => f.status === "pending");
  const allDone = files.length > 0 && files.every(f => f.status === "done");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Upload Documents</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer",
              dragging ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
            )}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className={cn("w-8 h-8 mx-auto mb-3", dragging ? "text-blue-500" : "text-slate-300")} />
            <p className="text-sm font-medium text-slate-700">Drop files here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, TIFF, DOCX — up to 50MB each</p>
            <input id="file-input" type="file" multiple accept={ALLOWED.join(",")}
              className="hidden" onChange={e => addFiles(e.target.files)} />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <FileIcon type={f.file.type} />
                  <div className="flex-1 min-w-0">
                    {f.status === "pending" ? (
                      <input value={f.name}
                        onChange={e => setFiles(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        className="w-full text-sm font-medium text-slate-800 bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                    )}
                    <p className="text-xs text-slate-400">{formatBytes(f.file.size)}</p>
                  </div>
                  {f.status === "uploading" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />}
                  {f.status === "done" && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                  {f.status === "error" && (
                    <span title={f.error} className="shrink-0">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </span>
                  )}
                  {f.status === "pending" && (
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-slate-500 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={allDone ? onClose : () => { if (!hasPending) onClose(); }}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition">
              {allDone ? "Close" : "Cancel"}
            </button>
            {!allDone && (
              <button onClick={uploadAll} disabled={!hasPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                Upload {files.filter(f => f.status === "pending").length} File(s)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      return api.get(`/documents?${params}`).then(r => apiJson<any>(r));
    },
    placeholderData: (prev: any) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`).then(r => apiJson(r)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); toast("Document deleted", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const docs: Document[] = data?.data || [];

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Documents</h1>
            <p className="text-sm text-slate-500 mt-0.5">{data?.pagination?.total || 0} documents</p>
          </div>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Document</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Size</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Tasks</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Uploaded</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></td></tr>
              )}
              {!isLoading && docs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">No documents yet. Upload one to get started.</td></tr>
              )}
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileIcon type={doc.fileType} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.originalName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {doc.fileType.split("/")[1]?.toUpperCase().replace("VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT", "DOCX")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatBytes(doc.fileSize)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                      doc._count.tasks > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {doc._count.tasks} task{doc._count.tasks !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(doc.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-blue-600 text-xs">
                        View
                      </a>
                      <button onClick={() => {
                        if (doc._count.tasks > 0) { toast("Cannot delete: document has tasks", "error"); return; }
                        if (confirm("Delete this document?")) deleteMutation.mutate(doc.id);
                      }}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.pagination?.pages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {page} of {data.pagination.pages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 disabled:opacity-40 hover:bg-slate-50">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </AppShell>
  );
}
