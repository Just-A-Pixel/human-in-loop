import type { JSX } from "react/jsx-runtime";

export default function PageSection({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="p-4">{children}</div>;
}
