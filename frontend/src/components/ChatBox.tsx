import type { JSX } from "react/jsx-runtime";

export default function ChatBox({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex">
      <div className="flex-none w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">U</div>
      <div className="ml-3">
        <div className="inline-block bg-indigo-50 border border-indigo-100 text-slate-800 p-3 rounded-lg max-w-xl whitespace-pre-wrap">
          {text}
        </div>
      </div>
    </div>
  )
}
