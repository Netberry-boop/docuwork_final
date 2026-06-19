"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiData } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { DollarSign, CheckCircle, Loader2, Plus, Download } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Payment {
  id: string;
  amount: number;
  type: string;
  description?: string;
  isPaid: boolean;
  paidAt?: string;
  createdAt: string;
  worker: { id: string; name: string; email: string };
}

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [isPaidFilter, setIsPaidFilter] = useState<"all" | "pending" | "paid">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["payments", page, isPaidFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (isPaidFilter === "pending") params.set("isPaid", "false");
      if (isPaidFilter === "paid") params.set("isPaid", "true");
      return api.get(`/payments?${params}`).then(r => apiData<any>(r));
    },
    placeholderData: (prev: any) => prev,
  });

  const markPaidMutation = useMutation({
    mutationFn: (paymentIds: string[]) =>
      api.patch("/payments", { paymentIds }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); toast("Payments marked as paid", "success"); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const payments: Payment[] = data?.payments || [];
  const pendingTotal = payments.filter(p => !p.isPaid).reduce((a, p) => a + p.amount, 0);

  function exportCSV() {
    const rows = [
      ["Worker", "Email", "Amount", "Type", "Description", "Status", "Date"],
      ...payments.map(p => [
        p.worker.name, p.worker.email, p.amount, p.type,
        p.description || "", p.isPaid ? "Paid" : "Pending", formatDate(p.createdAt)
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "payments.csv"; a.click();
  }

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Payments</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Total tracked: {formatCurrency(data?.totalAmount || 0)}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Amount", value: formatCurrency(data?.totalAmount || 0), color: "text-slate-700" },
            { label: "Pending Payout", value: formatCurrency(pendingTotal), color: "text-orange-600" },
            { label: "Payments", value: data?.pagination?.total || 0, color: "text-blue-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["all", "pending", "paid"] as const).map(f => (
            <button key={f} onClick={() => { setIsPaidFilter(f); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition",
                isPaidFilter === f ? "bg-blue-600 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
              )}>
              {f}
            </button>
          ))}
        </div>

        {/* Mark all pending as paid */}
        {isPaidFilter !== "paid" && payments.filter(p => !p.isPaid).length > 0 && (
          <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm text-orange-800">
              {payments.filter(p => !p.isPaid).length} pending payments totalling {formatCurrency(pendingTotal)}
            </p>
            <button
              onClick={() => markPaidMutation.mutate(payments.filter(p => !p.isPaid).map(p => p.id))}
              disabled={markPaidMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-60">
              {markPaidMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Mark All Paid
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Worker</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Description</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></td></tr>
              )}
              {!isLoading && payments.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No payments found</td></tr>
              )}
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{p.worker.name}</p>
                    <p className="text-xs text-slate-400">{p.worker.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-sm font-semibold", p.amount < 0 ? "text-red-600" : "text-slate-800")}>
                      {p.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(p.amount))}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                      p.type === "task" ? "bg-blue-100 text-blue-700" :
                      p.type === "bonus" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{p.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                      p.isPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {p.isPaid ? "Paid" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    {!p.isPaid && (
                      <button
                        onClick={() => markPaidMutation.mutate([p.id])}
                        className="text-xs text-blue-600 hover:underline">Mark paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
