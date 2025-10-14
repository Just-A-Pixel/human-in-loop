import type { JSX } from "react/jsx-runtime";

export default function FieldBlock({ label, children }: { label?: string; children?: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
