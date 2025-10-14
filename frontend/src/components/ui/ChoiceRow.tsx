import type { JSX } from "react/jsx-runtime";

export default function ChoiceRow({ children }: { children?: React.ReactNode }): JSX.Element {
  return <div className="flex gap-3 mt-2">{children}</div>;
}
