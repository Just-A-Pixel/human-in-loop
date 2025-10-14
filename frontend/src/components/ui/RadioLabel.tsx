import type { JSX } from "react/jsx-runtime";

export default function RadioLabel({ children }: { children?: React.ReactNode }): JSX.Element {
  return <label className="inline-flex items-center gap-2">{children}</label>;
}
