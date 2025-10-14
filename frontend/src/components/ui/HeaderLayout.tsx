// src/components/ui/HeaderLayout.tsx
import type { JSX } from "react/jsx-runtime";

export default function HeaderLayout({ left, right }: { left: React.ReactNode; right?: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
