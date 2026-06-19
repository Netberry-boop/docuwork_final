"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiJson, apiData } from "@/lib/client";
import { useAuthStore } from "@/store/auth";
import {
  Save, Send, Flag, ChevronLeft, ZoomIn, ZoomOut,
  Loader2, CheckCircle, AlertCircle,
  FileText, Clock, Type, ExternalLink
} from "lucide-react";

const AUTOSAVE_MS = 10_000;

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [content, setContent] = useState("");
  const [timeSpent, setTimeSpent] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [zoom, setZoom] = useState(100);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [flagSending, setFlagSending] = useState(false);

  const timerRef = useRef<NodeJS.Timeout>();
  const autosaveRef = useRef<NodeJS.Timeout>();

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // Fetch task
  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => api.get(`/tasks/${id}`).then(r => apiData<any>(r)),
  });

  // Fetch latest draft
  const { data: draft } = useQuery({
    queryKey: ["draft", id],
    queryFn: () => api.get(`/tasks/${id}/submit`).then(r => apiData<any>(r)),
  });

  // Load draft content
  useEffect(() => {
    if (draft?.content && !content) {
      setContent(draft.content);
      if (draft.timeSpentSec) setTimeSpent(draft.timeSpentSec);
    }
  }, [draft]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeSpent(t => t + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Autosave
  const saveDraft = useCallback(async () => {
    if (!content.trim()) return;
    setSaveStatus("saving");
    try {
      await api.post(`/tasks/${id}/submit`, {
        content,
        wordCount,
        charCount,
        timeSpentSec: timeSpent,
        isDraft: true,
      }).then(r => apiJson(r));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [content, wordCount, charCount, timeSpent, id]);

  useEffect(() => {
    autosaveRef.current = setInterval(saveDraft, AUTOSAVE_MS);
    return () => clearInterval(autosaveRef.current);
  }, [saveDraft]);

  // Mark as in-progress when they start typing
  const hasMarkedInProgress = useRef(false);
  useEffect(() => {
    if (content && !hasMarkedInProgress.current && task?.status === "ASSIGNED") {
      hasMarkedInProgress.current = true;
      api.patch(`/tasks/${id}`, { status: "IN_PROGRESS" }).catch(() => {});
    }
  }, [content, task?.status, id]);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post(`/tasks/${id}/submit`, {
        content,
        wordCount,
        charCount,
        timeSpentSec: timeSpent,
        isDraft: false,
      }).then(r => apiJson(r)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", id] });
      router.push("/worker/tasks");
    },
  });

  function formatTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${sec}s`;
  }

  if (taskLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600">Task not found</p>
          <button onClick={() => router.push("/worker/tasks")} className="mt-3 text-blue-600 text-sm hover:underline">
            Back to tasks
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = ["APPROVED", "COMPLETED", "SUBMITTED"].includes(task.status);
  
  // --- BULLETPROOF PDF IDENTIFICATION LOGIC ---
  const rawFileType = String(task.document?.fileType || "").toLowerCase().trim();
  const rawUrl = String(task.document?.storageUrl || "").toLowerCase().trim();
  const rawName = String(task.document?.name || "").toLowerCase().trim();

  // If fileType says pdf, url contains pdf, or the raw name contains .pdf, handle it as a PDF
  const isPdf = 
    rawFileType.includes("pdf") || 
    rawUrl.includes(".pdf") || 
    rawUrl.includes("pdf") ||
    rawName.includes(".pdf");

  // Console log diagnostics to see exactly what data structure your backend is returning
  console.log("=== DESKTOP WORKSPACE DEBUGGER ===");
  console.log("Document Name:", task.document?.name);
  console.log("Calculated IsPdf State:", isPdf);
  console.log("Database File Type Field:", task.document?.fileType);
  console.log("Cloud Storage Asset URL:", task.document?.storageUrl);
  console.log("==================================");

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col select-none">
      {/* Top bar */}
      <header className="h-13 bg-white border-b border-slate-200 flex items-center gap-3 px-4 shrink-0">
        <button
          onClick={() => router.push("/worker/tasks")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="w-px h-5 bg-slate-200" />

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{task.title}</h1>
          <p className="text-xs text-slate-400 truncate">{task.document?.name}</p>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Type className="w-3.5 h-3.5" /> {wordCount} words
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {formatTime(timeSpent)}
          </span>
        </div>

        {/* Save status */}
        <div className="text-xs text-slate-400">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" /> Error</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={saveDraft}
            disabled={saveStatus === "saving" || isCompleted}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>
          <button
            onClick={() => setShowIssue(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 rounded-lg text-sm text-orange-700 hover:bg-orange-50 transition"
          >
            <Flag className="w-3.5 h-3.5" />
            Flag Issue
          </button>
          <button
            onClick={() => setSubmitConfirm(true)}
            disabled={!content.trim() || isCompleted}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            <Send className="w-3.5 h-3.5" />
            Submit
          </button>
        </div>
      </header>

      {/* Split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Document viewer */}
        <div className="w-1/2 bg-slate-200 flex flex-col border-r border-slate-300">
          {/* Viewer toolbar */}
          <div className="h-10 bg-slate-800 flex items-center justify-between px-3 shrink-0">
            <span className="text-xs text-slate-300 truncate max-w-xs">{task.document?.name}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(z => Math.max(50, z - 10))}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-slate-300 w-12 text-center font-mono">{zoom}%</span>
              <button
                onClick={() => setZoom(z => Math.min(200, z + 10))}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Document Content Canvas Viewport */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100">
            {task.document?.storageUrl ? (
              <div 
                className="w-full h-full flex items-center justify-center transition-all"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
              >
                {isPdf ? (
                  <object
                    data={`${task.document.storageUrl}#toolbar=1&navpanes=0&view=FitH`}
                    type="application/pdf"
                    className="w-full h-full rounded-md shadow-lg border border-slate-300 bg-white"
                  >
                    <div className="w-[500px] bg-white p-8 border border-slate-200 rounded-xl text-center shadow-md flex flex-col items-center justify-center mx-auto">
                      <FileText className="w-12 h-12 text-blue-600 mb-3" />
                      <h4 className="font-semibold text-slate-800 text-sm mb-1">Inline View Standby</h4>
                      <p className="text-xs text-slate-400 mb-4 max-w-xs">Click here to render or inspect the attached workflow file directly:</p>
                      <a 
                        href={task.document.storageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium text-xs rounded-lg shadow"
                      >
                        Open Source File
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </object>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={task.document.storageUrl}
                    alt="Document Asset View"
                    className="max-w-full max-h-full object-contain shadow-md bg-white border border-slate-300 rounded-sm"
                    onError={(e) => {
                      // Ultra-safety fallback: If an asset falls into img component but fails to load as a pixel graphic, force change layout to link box
                      const element = e.currentTarget;
                      const canvas = element.parentElement;
                      if (canvas) {
                        canvas.innerHTML = `
                          <div class="w-[450px] bg-white p-8 border border-slate-200 rounded-xl text-center shadow-lg">
                            <svg class="w-12 h-12 text-blue-600 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            <h4 class="font-semibold text-slate-800 text-sm mb-1">Secure Document Asset Panel</h4>
                            <p class="text-xs text-slate-400 mb-4">Preview restricted by frame credentials. Launch to view side-by-side:</p>
                            <a href="${task.document.storageUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg">
                              Open Reference Document
                            </a>
                          </div>
                        `;
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Document preview unavailable</p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          {task.instructions && (
            <div className="p-3 bg-yellow-50 border-t border-yellow-200 text-xs text-yellow-800 shrink-0">
              <span className="font-semibold">Instructions:</span> {task.instructions}
            </div>
          )}
        </div>

        {/* Right: Text editor */}
        <div className="w-1/2 flex flex-col bg-white select-text">
          <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-4 shrink-0">
            <span className="text-xs text-slate-500 font-medium">Transcription</span>
            <div className="flex-1" />
            <span className="text-xs text-slate-400">{charCount} chars</span>
            {isCompleted && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {task.status.replace("_", " ")}
              </span>
            )}
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={isCompleted}
            placeholder="Start typing the digitized content here...

Transcribe the document exactly as written, preserving formatting where possible. Use Enter for paragraph breaks."
            className="flex-1 p-5 text-sm text-slate-800 leading-relaxed resize-none focus:outline-none font-mono disabled:bg-slate-50 disabled:text-slate-500"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          />

          {/* Bottom stats bar */}
          <div className="h-8 bg-slate-50 border-t border-slate-200 flex items-center px-4 gap-4 text-xs text-slate-400 shrink-0">
            <span>{wordCount} words</span>
            <span>·</span>
            <span>{charCount} characters</span>
            <span>·</span>
            <span>Time: {formatTime(timeSpent)}</span>
            {task.estimatedPages && (
              <>
                <span>·</span>
                <span>{task.estimatedPages} pages est.</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Submit confirm modal */}
      {submitConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-slate-900 mb-2">Submit for Review?</h3>
            <p className="text-sm text-slate-500 mb-5">
              You&apos;re about to submit <strong>{wordCount} words</strong> for manager review. 
              You won&apos;t be able to edit once submitted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSubmitConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setSubmitConfirm(false); submitMutation.mutate(); }}
                disabled={submitMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag issue modal */}
      {showIssue && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-slate-900 mb-2">Flag an Issue</h3>
            <textarea
              value={issueText}
              onChange={e => setIssueText(e.target.value)}
              placeholder="Describe the issue with this document..."
              rows={4}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowIssue(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!issueText.trim()) { setShowIssue(false); return; }
                  setFlagSending(true);
                  try {
                    await api.post("/messages", {
                      receiverId: task.createdById,
                      taskId: task.id,
                      content: `⚠️ Issue flagged on "${task.title}": ${issueText.trim()}`,
                    });
                    setShowIssue(false);
                    setIssueText("");
                  } catch {
                    setShowIssue(false);
                  } finally {
                    setFlagSending(false);
                  }
                }}
                disabled={flagSending}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {flagSending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}