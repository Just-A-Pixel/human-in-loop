import ApprovalsList from './components/ApprovalsList'

export default function App() {
  const userId = getAuthenticatedUserId()
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <ApprovalsList userId={userId} />
      </div>
    </div>
  )
}

// Returns "test" user, implement with jwt auth in prod
function getAuthenticatedUserId() {
  return "test"
}
