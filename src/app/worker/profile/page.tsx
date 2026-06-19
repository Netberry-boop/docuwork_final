"use client";

import { useState } from "react";
import AppShell from "@/components/shared/AppShell";
import { useAuthStore } from "@/store/auth";
import { api, apiJson } from "@/lib/client";
import { toast } from "@/components/ui/toaster";
import { Loader2, Save, User, Shield, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WorkerProfilePage() {
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [newPwd, setNewPwd] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch(`/workers/${user?.id}`, { name }).then(r => apiJson(r));
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
      await api.patch(`/workers/${user?.id}`, { password: newPwd }).then(r => apiJson(r));
      toast("Password changed. Logging you out...", "success");
      setTimeout(() => { logout(); router.push("/login"); }, 1500);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleLogout() {
    await api.post("/auth/logout", { refreshToken }).catch(() => {});
    logout();
    router.push("/login");
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your account details</p>
        </div>

        {/* Avatar + info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-2xl shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-lg">{user?.name}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Worker
            </span>
          </div>
        </div>

        {/* Edit profile */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800">Personal Info</h2>
          </div>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input value={user?.email} disabled
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
            <button type="submit" disabled={savingProfile}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition">
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </form>
        </div>

        {/* Change password */}
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

        {/* Logout */}
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </AppShell>
  );
}
