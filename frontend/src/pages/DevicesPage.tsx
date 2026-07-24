import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { ApiError } from "../api/client";
import {
  deleteDevice,
  listDevices,
  registerDevice,
  type DeviceDto,
  type RegisterDeviceInput,
} from "../api/devices";

const emptyForm: RegisterDeviceInput = {
  deviceId: "",
  publicKey: "",
  label: "",
};

/** Backoffice devices view: list all registered devices and register new ones. */
export default function DevicesPage() {
  const auth = useAuth();
  const token = auth.user?.access_token;

  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<RegisterDeviceInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeviceDto | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDevices(await listDevices(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load devices");
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
      await registerDevice(token, form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to register device"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const update =
    (field: keyof RegisterDeviceInput) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">
          Register a device
        </h2>
        <form
          onSubmit={onSubmit}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <Field
            label="Device ID"
            placeholder="device-box-01"
            value={form.deviceId}
            onChange={update("deviceId")}
          />
          <Field
            label="Label"
            placeholder="Medicine-Box"
            value={form.label}
            onChange={update("label")}
          />
          <Field
            label="Public key (hex)"
            placeholder="64-char Ed25519 key"
            value={form.publicKey}
            onChange={update("publicKey")}
          />
          <div className="sm:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? "Registering..." : "Register device"}
            </button>
            {formError && (
              <span className="text-sm text-red-600">{formError}</span>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Devices</h2>
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
        ) : devices.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">
            No devices registered yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-t border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Device ID</th>
                  <th className="px-6 py-3">Label</th>
                  <th className="px-6 py-3">Public key</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Registered</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {d.deviceId}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{d.label}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">
                      {d.publicKey.slice(0, 16)}…
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={
                          d.status === "active"
                            ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                            : d.status === "assigned"
                              ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                              : "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        }
                      >
                        {d.status === "assigned" && d.inTransit
                          ? "assigned - in transit"
                          : d.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(d)}
                        disabled={d.status === "assigned"}
                        title={
                          d.status === "assigned"
                            ? "Assigned to a delivery. Finish the delivery first."
                            : undefined
                        }
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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
        <DeleteDeviceModal
          device={deleteTarget}
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

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </label>
  );
}

function DeleteDeviceModal({
  device,
  token,
  onClose,
  onDeleted,
}: {
  device: DeviceDto;
  token: string | undefined;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === device.deviceId && !deleting;

  const onConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDevice(token, device.deviceId);
      await onDeleted();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete device"
      );
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">Delete device</h3>
        <p className="mt-2 text-sm text-slate-600">
          This permanently removes{" "}
          <span className="font-medium text-slate-800">{device.label}</span>.
          Its readings will no longer be accepted by the gateway. This action
          cannot be undone.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Type the device id{" "}
          <span className="font-mono font-medium text-slate-800">
            {device.deviceId}
          </span>{" "}
          to confirm.
        </p>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={device.deviceId}
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
            {deleting ? "Deleting..." : "Delete device"}
          </button>
        </div>
      </div>
    </div>
  );
}
