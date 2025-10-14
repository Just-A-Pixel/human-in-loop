// src/components/ui/BackButton.tsx
import type { JSX } from "react/jsx-runtime";

export default function BackButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button onClick={onClick} className="px-3 py-1 rounded-md border text-sm text-slate-600 hover:bg-slate-50">
      Back
    </button>
  );
}
