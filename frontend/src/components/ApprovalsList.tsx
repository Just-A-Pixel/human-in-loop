import React, { useEffect, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import ApprovalDetail, { type Turn } from "./ApprovalDetail";

import PageSection from "./ui/PageSection";
import Heading from "./ui/Heading";
import GridLayout from "./ui/GridLayout";
import ListColumn from "./ui/ListColumn";
import ListItemButton from "./ui/ListItemButton";
import ItemLeft from "./ui/ItemLeft";
import ItemRight from "./ui/ItemRight";
import DetailColumn from "./ui/DetailColumn";
import DetailPlaceholder from "./ui/DetailPlaceholder";

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
    <PageSection>
      <Heading>Pending Approvals</Heading>

      <GridLayout
        left={
          <ListColumn>
            {approvals.map((a) => (
              <ListItemButton key={a.context_id} onClick={() => setSelected(a)}>
                <ItemLeft contextId={a.context_id} title={a.title} />
                <ItemRight deadline={a.deadline} />
              </ListItemButton>
            ))}
          </ListColumn>
        }
        right={
          <DetailColumn>
            {selected ? <ApprovalDetail approval={selected} onClose={() => setSelected(null)} /> : <DetailPlaceholder />}
          </DetailColumn>
        }
      />
    </PageSection>
  );
}
