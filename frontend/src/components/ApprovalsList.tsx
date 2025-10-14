import React, { useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import ApprovalDetail, { type Turn } from "./ApprovalDetail";

export type ApprovalSummary = {
  context_id: string;
  approver_name?: string;
  title?: string;
  deadline?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  snapshot?: any;
  turns?: Turn[];
};

type ApiResponse = {
  ok: boolean;
  approvals: ApprovalSummary[];
};

export default function ApprovalsList({ userId }: { userId: string }): JSX.Element {
  const [approvals, setApprovals] = useState<ApprovalSummary[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApprovalSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchApprovals() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/getAllRequests?userId=${encodeURIComponent(userId)}`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!mounted) return;
        if (!json.ok) throw new Error("API returned ok=false");
        setApprovals(json.approvals);
      } catch (err: any) {
        console.error("fetchApprovals error", err);
        if (!mounted) return;
        setError(err.message ?? String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchApprovals();
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (loading) return <div className="p-4">Loading approvals…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!approvals || approvals.length === 0) return <div className="p-4">No pending approvals.</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Pending Approvals</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: list */}
        <div className="md:col-span-1 space-y-3">
          {approvals.map((a) => (
            <button
              key={a.context_id}
              onClick={() => setSelected(a)}
              className="w-full text-left bg-white rounded-lg shadow p-3 flex items-center justify-between hover:ring-1 hover:ring-indigo-100"
            >
              <div>
                <div className="text-xs text-slate-500">Context</div>
                <div className="font-mono text-sm">{a.context_id}</div>
                <div className="mt-2 font-medium text-slate-800">{a.title}</div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">Deadline</div>
                <div className="mt-1 text-sm font-medium text-red-600">
                  {a.deadline ? new Date(a.deadline).toLocaleString() : "—"}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right: detail */}
        <div className="md:col-span-2">
          {selected ? (
            <ApprovalDetail approval={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="bg-white rounded-lg p-6 shadow text-slate-500">
              Select an approval to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
