"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, CheckCircle, XCircle } from "lucide-react";

function VerifyEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setStatus("success");
          setMessage(json.data?.message || "Email verified successfully.");
        } else {
          setStatus("error");
          setMessage(json.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [params]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">DocuWork</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-sm">Verifying your email...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Email verified</h2>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <button onClick={() => router.push("/login")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
                Continue to Login
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Verification failed</h2>
              <p className="text-sm text-slate-500 mb-6">{message}</p>
              <Link href="/login" className="text-sm text-blue-600 hover:underline">Back to login</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}