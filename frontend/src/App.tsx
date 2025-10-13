import React from 'react'
import ChatBox from './components/ChatBox'
import DiffViewer from './components/UnifiedDiffRenderer'

// replace the FAKE const in src/App.jsx with this:

const FAKE = {
  ui_schema: {
    title: "Approve production deploy?",
    fields: [
      { id: "decision", type: "choice", options: ["approve", "reject"], required: true },
      { id: "notes", type: "textarea", label: "Reviewer comments" }
    ]
  },
  snapshot: {
    context_id: "ctx-abc-259",
    turns: [
      {
        role: "user",
        text: "Deploy checkout service to prod",
        ui_schema: { render_type: "chat-box" }
      },
      {
        role: "assistant",
        text: "Preparing deployment, awaiting approval...",
        ui_schema: {
          render_type: "diff",
          // actual commit bodies (multi-line). The DiffViewer will align and highlight changes.
          base: `commit abc1234e9f2b6a1c0d4e5f6a7b8c9d0e1f2a3456
Author: Raj Anand <raj@example.com>
Date:   2025-10-10 14:22:10 +0530

    fix: correct rounding bug in price calculation

diff --git a/services/checkout/index.js b/services/checkout/index.js
- const rounding = Math.round(total * 100) / 100;
+ const rounding = Number((Math.round(total * 100) / 100).toFixed(2));
`,

          target: `commit def5678b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5678
Author: Raj Anand <raj@example.com>
Date:   2025-10-12 09:18:44 +0530

    feat: add idempotency key to checkout to prevent double-charges

diff --git a/services/checkout/index.js b/services/checkout/index.js
- const rounding = Number((Math.round(total * 100) / 100).toFixed(2));
+ const rounding = Number((Math.round(total * 100) / 100).toFixed(2));
+ // new: use idempotency key to dedupe requests
+ checkoutRequest.headers['Idempotency-Key'] = generateIdempotencyKey(order.id);
`
        }
      }
    ]
  }
}


export default function App() {
  const turns = FAKE.snapshot.turns

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-indigo-600">HITL — Approval (Demo)</h1>
          <p className="text-sm text-slate-500 mt-1">Per-turn renderers: <span className="font-medium">chat-box</span>, <span className="font-medium">diff</span></p>
        </header>

        <main className="grid grid-cols-1 gap-4">
          {turns.map((t, i) => {
            const type = t.ui_schema?.render_type || 'chat-box'
            return (
              <div key={i} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-start justify-between">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">{t.role}</div>
                  <div className="text-xs text-slate-400">turn #{i + 1}</div>
                </div>

                <div className="mt-3">
                  {type === 'chat-box' && <ChatBox text={t.text} />}
                  {type === 'diff' && <DiffViewer base={t.ui_schema.base} target={t.ui_schema.target} text={t.text} />}
                </div>
              </div>
            )
          })}
        </main>

        <footer className="mt-8 text-center text-sm text-slate-500">Demo — only React + Tailwind</footer>
      </div>
    </div>
  )
}
