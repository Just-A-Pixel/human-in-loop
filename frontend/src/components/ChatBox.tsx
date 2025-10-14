import type { JSX } from "react/jsx-runtime";
import ChatBoxLayout from "./ui/ChatBoxLayout";

export default function ChatBox({ text }: { text: string }): JSX.Element {
  return (
    <ChatBoxLayout>
          {text}
    </ChatBoxLayout>
  )
}
