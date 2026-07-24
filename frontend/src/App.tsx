import { useAuth } from "react-oidc-context";
import { Navigate, Route, Routes } from "react-router-dom";
import { CenteredCard } from "./components/CenteredCard";
import { Layout } from "./components/Layout";
import DevicesPage from "./pages/DevicesPage";
import CarriersPage from "./pages/CarriersPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import { config } from "./config";

export default function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <CenteredCard title="Loading…" />;
  }

  if (auth.error) {
    return (
      <CenteredCard title="Authentication error">
        <p>{auth.error.message}</p>
        <button
          onClick={() => void auth.signinRedirect()}
          className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Try again
        </button>
      </CenteredCard>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <CenteredCard title="ColdProof Backoffice">
        <p>Sign in with your administrator account to continue.</p>
        <button
          onClick={() => void auth.signinRedirect()}
          className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Sign in
        </button>
      </CenteredCard>
    );
  }

  const groups =
    (auth.user?.profile?.["cognito:groups"] as string[] | undefined) ?? [];
  const isAdmin = groups.includes(config.adminGroup);

  if (!isAdmin) {
    return (
      <CenteredCard title="Access denied">
        <p>
          Your account is not a member of the{" "}
          <span className="font-mono">{config.adminGroup}</span> group required
          to use the backoffice.
        </p>
        <button
          onClick={() => void auth.removeUser()}
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </CenteredCard>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DevicesPage />} />
        <Route path="/carriers" element={<CarriersPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
