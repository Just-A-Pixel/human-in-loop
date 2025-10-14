import type { JSX } from "react/jsx-runtime";

export default function InputField({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border p-2 mt-1" />;
}
