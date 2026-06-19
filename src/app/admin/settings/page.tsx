"use client";

import { useState } from "react";
import AppShell from "@/components/shared/AppShell";
import { useAuthStore } from "@/store/auth";
import { api, apiJson } from "@/lib/client";
import { toast } from "@/components/ui/toaster";
import { Loader2, Save, Shield, Database } from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [newPwd, setNewPwd] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const json = await api.patch("/auth/me", { name }).then(r => apiJson<any>(r));
      updateUser({ name: json.data.name });
      toast("Profile updated", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) { toast("Password must be at least 8 characters", "error"); return; }
    setSavingPwd(true);
    try {
      await api.patch("/auth/me", { password: newPwd }).then(r => apiJson(r));
      toast("Password changed. Please log in again.", "success");
      setNewPwd("");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your account and platform preferences</p>
        </div>

        {/* Profile */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Display Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input value={user?.email} disabled
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Role</label>
              <input value={user?.role?.replace("_", " ")} disabled
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
            <button type="submit" disabled={savingProfile}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800">Change Password</h2>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">New Password</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                placeholder="Min 8 characters"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={savingPwd || !newPwd}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
              {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Update Password
            </button>
          </form>
        </div>

        {/* System info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800">System</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Platform</span>
              <span className="font-medium">DocuWork SaaS</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Stack</span>
              <span className="font-medium">Next.js 16 · PostgreSQL · Prisma</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
