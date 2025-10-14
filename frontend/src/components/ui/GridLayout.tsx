import type { JSX } from "react/jsx-runtime";

export default function GridLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-1">{left}</div>
      <div className="md:col-span-2">{right}</div>
    </div>
  );
}
