// src/components/ApprovalDetail.tsx
import React from "react";
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

export default function ApprovalDetail(props: {
  approval: Approval;
  onClose: () => void;
}): JSX.Element {
  const { approval, onClose } = props;

  async function handleAction(action: "approve" | "deny" | "rollback") {
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

    try {
      const resp = await fetch(`/api/approval/${encodeURIComponent(approval.context_id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actor: "test", notes }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        alert("Action failed: " + (json?.message ?? JSON.stringify(json)));
        return;
      }
      // optional: show result
      alert(`Action completed: status -> ${json.status}`);
    } catch (err: any) {
      console.error("Action error", err);
      alert("Action failed: " + String(err));
    }
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
