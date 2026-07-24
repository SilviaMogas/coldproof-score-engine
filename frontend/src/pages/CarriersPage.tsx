import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { ApiError } from "../api/client";
import {
  deleteCarrier,
  listCarriers,
  registerCarrier,
  type CarrierDto,
} from "../api/carriers";

/** Backoffice carriers view: list all carriers and register new ones. */
export default function CarriersPage() {
  const auth = useAuth();
  const token = auth.user?.access_token;

  const [carriers, setCarriers] = useState<CarrierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CarrierDto | null>(
    null
  );

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setCarriers(await listCarriers(token));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load carriers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await registerCarrier(token, { name });
      setName("");
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to register carrier"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">
          Register a carrier
        </h2>
        <form
          onSubmit={onSubmit}
          className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <label className="block flex-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Frío Express S.A."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || name.trim().length === 0}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? "Registering..." : "Register carrier"}
            </button>
            {formError && (
              <span className="text-sm text-red-600">{formError}</span>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Carriers
          </h2>
          <button
            onClick={() => void refresh()}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-slate-500">Loading...</p>
        ) : loadError ? (
          <p className="px-6 py-8 text-sm text-red-600">{loadError}</p>
        ) : carriers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">
            No carriers registered yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-t border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {carriers.map((t) => (
                  <tr key={t.id}>
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {t.name}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">
                      {t.id}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deleteTarget && (
        <DeleteCarrierModal
          carrier={deleteTarget}
          token={token}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async () => {
            setDeleteTarget(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function DeleteCarrierModal({
  carrier,
  token,
  onClose,
  onDeleted,
}: {
  carrier: CarrierDto;
  token: string | undefined;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === carrier.name && !deleting;

  const onConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCarrier(token, carrier.id);
      await onDeleted();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete carrier"
      );
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">
          Delete carrier
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          This permanently removes{" "}
          <span className="font-medium text-slate-800">
            {carrier.name}
          </span>
          . This action cannot be undone.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Type the name{" "}
          <span className="font-medium text-slate-800">
            {carrier.name}
          </span>{" "}
          to confirm.
        </p>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={carrier.name}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={!canDelete}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete carrier"}
          </button>
        </div>
      </div>
    </div>
  );
}
