import { useAuth } from "react-oidc-context";
import { NavLink } from "react-router-dom";
import { cognitoLogoutUrl } from "../auth/oidc";

/** App shell: top bar with product name, current user and sign-out. */
export function Layout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const email =
    (auth.user?.profile?.email as string | undefined) ??
    (auth.user?.profile?.["cognito:username"] as string | undefined) ??
    "signed in";

  const signOut = async () => {
    await auth.removeUser();
    const url = cognitoLogoutUrl();
    if (url) {
      window.location.assign(url);
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "text-sm font-medium text-slate-800"
      : "text-sm font-medium text-slate-500 hover:text-slate-700";

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-800">
                ColdProof
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Backoffice
              </span>
            </div>
            <nav className="flex items-center gap-4">
              <NavLink to="/" end className={navClass}>
                Devices
              </NavLink>
              <NavLink to="/carriers" className={navClass}>
                Carriers
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{email}</span>
            <button
              onClick={signOut}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
