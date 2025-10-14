import { type JSX } from "react";
import ApprovalsList from "./components/ApprovalsList";
import Layout from "./components/ui/Layout";

export default function App(): JSX.Element {
  const userId = getAuthenticatedUserId();
  return (
    <Layout>
      <ApprovalsList userId={userId} />
    </Layout>
  );
}

// Returns "test" user, implement with jwt auth in prod
function getAuthenticatedUserId() {
  return "test";
}
