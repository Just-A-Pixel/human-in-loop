import type { JSX } from "react/jsx-runtime";

export default function DiffFileCard({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="border rounded bg-white">{children}</div>;
}
