// src/components/ui/ActionButtons.tsx
import type { JSX } from "react/jsx-runtime";

export default function ActionButtons({
  onApprove,
  onDeny,
  onRollback,
}: {
  onApprove: () => void;
  onDeny: () => void;
  onRollback: () => void;
}): JSX.Element {
  return (
    <div className="flex gap-2 mt-3">
      <button onClick={onApprove} className="px-3 py-1 rounded-md bg-emerald-600 text-white hover:opacity-95">
        Approve
      </button>

      <button onClick={onDeny} className="px-3 py-1 rounded-md bg-rose-600 text-white hover:opacity-95">
        Deny
      </button>

      <button onClick={onRollback} className="px-3 py-1 rounded-md bg-yellow-600 text-white hover:opacity-95">
        Rollback
      </button>
    </div>
  );
}
