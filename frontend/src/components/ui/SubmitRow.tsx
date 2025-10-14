import type { JSX } from "react/jsx-runtime";

export default function SubmitRow({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onClick} className="px-3 py-1 bg-indigo-600 text-white rounded">
        Submit
      </button>
    </div>
  );
}
