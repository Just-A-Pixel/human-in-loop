// src/components/ApprovalDetail.tsx
import React, { useEffect, useRef, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import ChatBox from "./ChatBox";
import UnifiedDiffRenderer from "./UnifiedDiffRenderer";
import UiNodeRenderer from "./UiNodeRenderer";

import Card from "./ui/Card";
import HeaderLayout from "./ui/HeaderLayout";
import TitleBlock from "./ui/TitleBlock";
import ActionButtons from "./ui/ActionButtons";
import BackButton from "./ui/BackButton";
import TurnsContainer from "./ui/TurnsContainer";
import TurnCard from "./ui/TurnCard";
import TurnHeader from "./ui/TurnHeader";

export type Turn = {
  role?: string;
  text?: string;
  createdAt?: string;
  ui_schema?: any;
};

type Snapshot = {
  context_id?: string;
  turns?: Turn[];
  [k: string]: any;
};

type Approval = {
  context_id: string;
  title?: string;
  deadline?: string | null;
  snapshot?: Snapshot;
  turns?: Turn[]; // top-level turns
  status?: string;
};

type ActionType = "approve" | "deny" | "rollback";

export default function ApprovalDetail(props: {
  approval: Approval;
  onClose: () => void;
}): JSX.Element {
  const { approval, onClose } = props;

  // UI state for queued / polling and result
  const [isQueued, setIsQueued] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | undefined>(approval.status);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // keep local status in sync if approval prop changes from parent
    setCurrentStatus(approval.status);
  }, [approval.status]);

  async function postAction(action: ActionType, notes?: string) {
    try {
      // send action to API
      const resp = await fetch(`/api/approval/${encodeURIComponent(approval.context_id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actor: "test", notes }),
      });

      // if server returns 202 Accepted or 200 OK, treat as queued/success
      if (resp.status === 202 || resp.ok) {
        // show queued UI and start polling
        setIsQueued(true);
        setQueueMessage("Action queued — updating status...");
        setPollError(null);

        // start polling
        const pollResult = await pollForStatusChange(approval.context_id, 30_000, 1000);
        setIsQueued(false);

        if (!mountedRef.current) return;

        if (pollResult.ok) {
          setCurrentStatus(pollResult.status);
          alert(`Action completed: status -> ${pollResult.status}`);
        } else {
          setPollError(pollResult.error ?? "Timed out waiting for status update");
          alert(`Action queued but final status not observed: ${pollResult.error ?? "timeout"}`);
        }
      } else {
        // non-accepted error
        const json = await resp.json().catch(() => null);
        const msg = json?.message ?? `HTTP ${resp.status}`;
        alert("Action failed: " + msg);
      }
    } catch (err: any) {
      console.error("Action error", err);
      alert("Action failed: " + String(err));
    }
  }

  async function handleAction(action: ActionType) {
    // optional: confirm
    const confirmMsg =
      action === "approve"
        ? "Are you sure you want to APPROVE this request?"
        : action === "deny"
        ? "Are you sure you want to DENY this request?"
        : "Are you sure you want to ROLLBACK this request? This will trigger the rollback process.";
    if (!confirm(confirmMsg)) return;

    // optionally collect notes for deny/rollback
    let notes: string | undefined = undefined;
    if (action === "deny") {
      notes = prompt("Optional: provide a suggested prompt or reason to accompany the denial:") ?? undefined;
    } else if (action === "rollback") {
      notes = prompt("Optional: message to explain rollback reason for automation / logs:") ?? undefined;
    }

    // trigger POST + polling
    await postAction(action, notes);
  }

  /**
   * Poll GET /api/approval/:contextId/status until status changes from 'pending'/'approval_requested'
   * or timeout elapses.
   */
  async function pollForStatusChange(contextId: string, timeoutMs = 30_000, intervalMs = 1000) {
    const start = Date.now();
    const pendingStates = new Set(["pending", "approval_requested"]);
    while (mountedRef.current && Date.now() - start < timeoutMs) {
      try {
        const resp = await fetch(`/api/approval/${encodeURIComponent(contextId)}/status`);
        if (resp.ok) {
          const json = await resp.json().catch(() => null);
          const status = json?.status ?? json?.data?.status ?? undefined;
          if (status && !pendingStates.has(status)) {
            return { ok: true, status };
          }
        } else if (resp.status === 404) {
          // not found — treat as failure to observe
          return { ok: false, error: "not_found" };
        }
      } catch (err: any) {
        // network error — keep trying until timeout
        console.warn("[ApprovalDetail] poll error", err);
      }

      // wait interval
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return { ok: false, error: "timeout" };
  }

  // Use snapshot.turns if present, fallback to top-level turns
  const turns: Turn[] = approval.snapshot?.turns ?? (approval.turns ?? []);

  return (
    <Card>
      <HeaderLayout
        left={
          <TitleBlock title={approval.title ?? approval.context_id} contextId={approval.context_id} deadline={approval.deadline}>
            <ActionButtons onApprove={() => handleAction("approve")} onDeny={() => handleAction("deny")} onRollback={() => handleAction("rollback")} />
          </TitleBlock>
        }
        right={<BackButton onClick={onClose} />}
      />

      {/* queued / polling UI */}
      {isQueued && (
        <div className="mb-3 flex items-center gap-3 text-sm text-slate-600">
          <svg className="w-4 h-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"></circle>
            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"></path>
          </svg>
          <div>{queueMessage}</div>
        </div>
      )}

      {pollError && <div className="mb-3 text-sm text-rose-600">Polling error: {pollError}</div>}

      <div className="text-xs text-slate-500 mb-3">
        Current status: <span className="font-medium">{currentStatus ?? "unknown"}</span>
      </div>

      <TurnsContainer>
        {turns.length === 0 && <div className="text-sm text-slate-500">No conversation turns.</div>}

        {turns.map((turn, i) => (
          <TurnCard key={i}>
            <TurnHeader role={turn.role} index={i} />

            <UiNodeRenderer
              node={turn.ui_schema ?? { render_type: "chat-box", text: turn.text }}
              path={`turn${i}`}
              onFormSubmit={(formId, values, meta) => {
                console.log("Form submitted:", formId, values, meta);
                // TODO: integrate backend submission (e.g., call your Forwarder API or Kafka producer)
              }}
            />
          </TurnCard>
        ))}
      </TurnsContainer>
    </Card>
  );
}
