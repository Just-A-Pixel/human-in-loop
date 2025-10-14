import type { JSX } from "react/jsx-runtime";

export default function TextareaField({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border p-2 mt-1" />;
}
