"use client";

import dynamic from "next/dynamic";

const AdminShell = dynamic(
  () => import("@/components/admin/AdminShell").then((mod) => mod.AdminShell),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function AdminDashboardPage() {
  return <AdminShell initialView="dashboard" />;
}
