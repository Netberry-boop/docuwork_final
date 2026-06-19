"use client";

import { useQuery } from "@tanstack/react-query";
import { api, apiData } from "@/lib/client";
import AppShell from "@/components/shared/AppShell";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DollarSign, TrendingUp, Clock, CheckCircle, Loader2 } from "lucide-react";

export default function EarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-payments"],
    queryFn: () => api.get("/payments?limit=50").then(r => apiData<any>(r)),
  });

  const payments = data?.payments || [];
  const totalEarned = payments.reduce((a: number, p: any) => a + p.amount, 0);
  const totalPaid = payments.filter((p: any) => p.isPaid).reduce((a: number, p: any) => a + p.amount, 0);
  const totalPending = payments.filter((p: any) => !p.isPaid).reduce((a: number, p: any) => a + p.amount, 0);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Earnings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your payment history and pending amounts</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Earned", value: formatCurrency(totalEarned), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Paid Out", value: formatCurrency(totalPaid), icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending", value: formatCurrency(totalPending), icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-500">{s.label}</p>
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Payment history */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Payment History</h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No payments yet. Complete tasks to earn.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Description</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-sm text-slate-700">{p.description || `Payment for task`}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                        p.type === "task" ? "bg-blue-100 text-blue-700" :
                        p.type === "bonus" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-semibold", p.amount < 0 ? "text-red-600" : "text-slate-800")}>
                        {p.amount < 0 ? "−" : "+"}{formatCurrency(Math.abs(p.amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                        p.isPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {p.isPaid ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
