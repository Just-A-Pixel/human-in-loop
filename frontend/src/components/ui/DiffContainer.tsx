import type { JSX } from "react/jsx-runtime";

export default function DiffContainer({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="space-y-6">{children}</div>;
}
