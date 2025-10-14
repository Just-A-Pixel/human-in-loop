import React from "react";
import type { JSX } from "react/jsx-runtime";
import ChatBox from "./ChatBox";
import UnifiedDiffRenderer from "./UnifiedDiffRenderer";
import UiNodeRenderer from "./UiNodeRenderer";

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
     // refresh the selected approval status by loading /api/approval/:contextId/status or re-fetch the approvals list
     // you can also set local state to update UI
   } catch (err: any) {
     console.error("Action error", err);
     alert("Action failed: " + String(err));
   }
 }
 

  // Use snapshot.turns if present, fallback to top-level turns
  const turns: Turn[] = approval.snapshot?.turns ?? (approval.turns ?? []);

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{approval.title ?? approval.context_id}</h2>
          <div className="text-xs text-slate-500 mt-1">
            Context: <span className="font-mono">{approval.context_id}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Deadline:{" "}
            <span className="font-medium">
              {approval.deadline ? new Date(approval.deadline).toLocaleString() : "—"}
            </span>
          </div>
<div className="flex gap-2 mt-3">
  <button
    onClick={() => handleAction("approve")}
    className="px-3 py-1 rounded-md bg-emerald-600 text-white hover:opacity-95"
  >
    Approve
  </button>

  <button
    onClick={() => handleAction("deny")}
    className="px-3 py-1 rounded-md bg-rose-600 text-white hover:opacity-95"
  >
    Deny
  </button>

  <button
    onClick={() => handleAction("rollback")}
    className="px-3 py-1 rounded-md bg-yellow-600 text-white hover:opacity-95"
  >
    Rollback
  </button>
</div>

        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md border text-sm text-slate-600 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {turns.length === 0 && <div className="text-sm text-slate-500">No conversation turns.</div>}

        {turns.map((turn, i) => (
          <div key={i} className="bg-slate-50 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-400 uppercase">{turn.role ?? "assistant"}</div>
              <div className="text-xs text-slate-400">turn #{i + 1}</div>
            </div>

            {/* 🎯 NEW: Render nested UI schema recursively */}
            <UiNodeRenderer
              node={turn.ui_schema ?? { render_type: "chat-box", text: turn.text }}
              path={`turn${i}`}
              onFormSubmit={(formId, values, meta) => {
                console.log("Form submitted:", formId, values, meta);
                // TODO: integrate backend submission (e.g., call your Forwarder API or Kafka producer)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


