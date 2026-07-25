import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { ApiError } from "../api/client";
import {
  deleteDelivery,
  finishDelivery,
  startDelivery,
  confirmEscrow,
  listAvailableDevices,
  listDeliveries,
  registerDelivery,
  type AvailableDeviceDto,
  type DeliveryDto,
  type RegisterDeliveryInput,
} from "../api/deliveries";
import { listCarriers, type CarrierDto } from "../api/carriers";
import { getConfig, type AppConfig } from "../api/config";
import { fundDeliveryEscrow } from "../web3/escrow";

const emptyForm: RegisterDeliveryInput = {
  from: "",
  to: "",
  boxContents: "",
  deviceId: "",
  carrierId: "",
};

/** Backoffice deliveries view: list deliveries and create new ones. */
export default function DeliveriesPage() {
  const auth = useAuth();
  const token = auth.user?.access_token;

  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [devices, setDevices] = useState<AvailableDeviceDto[]>([]);
  const [carriers, setCarriers] = useState<CarrierDto[]>([]);
  const [settlementEnabled, setSettlementEnabled] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<RegisterDeliveryInput>(emptyForm);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeliveryDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [d, dev, car, cfg] = await Promise.all([
        listDeliveries(token),
        listAvailableDevices(token),
        listCarriers(token),
        getConfig(),
      ]);
      setDeliveries(d);
      setDevices(dev);
      setCarriers(car);
      setSettlementEnabled(cfg.settlementEnabled);
      setAppConfig(cfg);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load deliveries"
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
      const amountEth = amount.trim() ? Number(amount) : 0;
      await registerDelivery(token, { ...form, amountEth });
      setForm(emptyForm);
      setAmount("");
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create delivery"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const update =
    (field: keyof RegisterDeliveryInput) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const onStart = async (delivery: DeliveryDto) => {
    setStartingId(delivery.id);
    setRowError(null);
    try {
      await startDelivery(token, delivery.id);
      await refresh();
    } catch (err) {
      setRowError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to start delivery"
      );
    } finally {
      setStartingId(null);
    }
  };

  const onConfirmEscrow = async (delivery: DeliveryDto) => {
    setConfirmingId(delivery.id);
    setRowError(null);
    try {
      await confirmEscrow(token, delivery.id);
      await refresh();
    } catch (err) {
      setRowError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to confirm escrow"
      );
    } finally {
      setConfirmingId(null);
    }
  };

  const onFundEscrow = async (delivery: DeliveryDto) => {
    if (!appConfig) return;
    setFundingId(delivery.id);
    setRowError(null);
    try {
      await fundDeliveryEscrow(delivery, appConfig);
      await confirmEscrow(token, delivery.id);
      await refresh();
    } catch (err) {
      setRowError(
        err instanceof Error ? err.message : "Failed to fund Sepolia escrow"
      );
    } finally {
      setFundingId(null);
    }
  };

  const onFinish = async (delivery: DeliveryDto) => {
    setFinishingId(delivery.id);
    setRowError(null);
    try {
      await finishDelivery(token, delivery.id);
      await refresh();
    } catch (err) {
      setRowError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to finish delivery"
      );
    } finally {
      setFinishingId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDelivery(token, deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete delivery"
      );
    } finally {
      setDeleting(false);
    }
  };

  const canSubmit =
    form.from.trim() &&
    form.to.trim() &&
    form.boxContents.trim() &&
    form.deviceId &&
    form.carrierId &&
    !submitting;

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">
          Create a delivery
        </h2>
        <form
          onSubmit={onSubmit}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <TextField
            label="From"
            placeholder="Buenos Aires warehouse"
            value={form.from}
            onChange={update("from")}
          />
          <TextField
            label="To"
            placeholder="Córdoba clinic"
            value={form.to}
            onChange={update("to")}
          />
          <TextField
            label="Box contents"
            placeholder="Insulin vials"
            value={form.boxContents}
            onChange={update("boxContents")}
          />
          <SelectField
            label="Device (active & free)"
            value={form.deviceId}
            onChange={update("deviceId")}
            placeholder={
              devices.length === 0
                ? "No available devices"
                : "Select a device"
            }
            disabled={devices.length === 0}
            options={devices.map((d) => ({
              value: d.deviceId,
              label: `${d.label} (${d.deviceId})`,
            }))}
          />
          <SelectField
            label="Carrier"
            value={form.carrierId}
            onChange={update("carrierId")}
            placeholder={
              carriers.length === 0 ? "No carriers" : "Select a carrier"
            }
            disabled={carriers.length === 0}
            options={carriers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextField
            label="Escrow amount (ETH, optional)"
            placeholder="e.g. 50 — leave blank for no escrow"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!settlementEnabled}
            hint={
              settlementEnabled
                ? "Held in escrow and released to the carrier only if the cold chain holds."
                : "Escrow settlement is not configured on this server."
            }
          />
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create delivery"}
            </button>
            {formError && (
              <span className="text-sm text-red-600">{formError}</span>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Deliveries</h2>
          <button
            onClick={() => void refresh()}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Refresh
          </button>
        </div>

        {rowError && (
          <p className="px-6 pb-2 text-sm text-red-600">{rowError}</p>
        )}

        {loading ? (
          <p className="px-6 py-8 text-sm text-slate-500">Loading...</p>
        ) : loadError ? (
          <p className="px-6 py-8 text-sm text-red-600">{loadError}</p>
        ) : deliveries.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">
            No deliveries created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-t border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">From</th>
                  <th className="px-6 py-3">To</th>
                  <th className="px-6 py-3">Box contents</th>
                  <th className="px-6 py-3">Device</th>
                  <th className="px-6 py-3">Carrier</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Escrow</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {d.from}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{d.to}</td>
                    <td className="px-6 py-3 text-slate-600">
                      {d.boxContents}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {d.deviceLabel ?? d.deviceId}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {d.carrierName ?? d.carrierId}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={
                          d.status === "ready"
                            ? "rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
                            : d.status === "in_transit"
                              ? "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                              : "rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        }
                      >
                        {d.status === "ready"
                          ? "Ready to begin"
                          : d.status === "in_transit"
                            ? "In transit"
                            : "Finished"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <EscrowCell delivery={d} />
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {d.status === "ready" &&
                          d.settlementStatus === "awaiting_escrow" && (
                            <>
                              <button
                                onClick={() => void onFundEscrow(d)}
                                disabled={fundingId === d.id}
                                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                              >
                                {fundingId === d.id
                                  ? "Funding..."
                                  : "Fund with wallet"}
                              </button>
                              <button
                                onClick={() => void onConfirmEscrow(d)}
                                disabled={confirmingId === d.id}
                                className="rounded-md border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                              >
                                {confirmingId === d.id
                                  ? "Confirming..."
                                  : "Already funded"}
                              </button>
                            </>
                          )}
                        {d.status === "ready" &&
                          d.settlementStatus !== "awaiting_escrow" && (
                            <button
                              onClick={() => void onStart(d)}
                              disabled={startingId === d.id}
                              className="rounded-md border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                            >
                              {startingId === d.id ? "Starting..." : "Start"}
                            </button>
                          )}
                        {d.status === "in_transit" && (
                          <button
                            onClick={() => void onFinish(d)}
                            disabled={finishingId === d.id}
                            className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {finishingId === d.id ? "Finishing..." : "Finish"}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(d);
                          }}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">
              Delete delivery
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete the delivery from{" "}
              <span className="font-medium text-slate-800">
                {deleteTarget.from}
              </span>{" "}
              to{" "}
              <span className="font-medium text-slate-800">
                {deleteTarget.to}
              </span>
              ? This frees its device for reassignment.
            </p>

            {deleteError && (
              <p className="mt-3 text-sm text-red-600">{deleteError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void onConfirmDelete()}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete delivery"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shows the escrow amount and settlement outcome for a delivery. */
function EscrowCell({ delivery }: { delivery: DeliveryDto }) {
  if (delivery.settlementStatus === "disabled" || delivery.amountEth <= 0) {
    return <span className="text-xs text-slate-400">No escrow</span>;
  }

  const badges: Record<
    Exclude<DeliveryDto["settlementStatus"], "disabled">,
    { label: string; className: string }
  > = {
    awaiting_escrow: {
      label: "Awaiting funds",
      className: "bg-orange-100 text-orange-700",
    },
    escrowed: { label: "Escrowed", className: "bg-violet-100 text-violet-700" },
    released: {
      label: "Released to carrier",
      className: "bg-emerald-100 text-emerald-700",
    },
    refunded: {
      label: "Refunded to shipper",
      className: "bg-rose-100 text-rose-700",
    },
    unsettled: { label: "Unsettled", className: "bg-slate-100 text-slate-600" },
  };

  const badge =
    badges[delivery.settlementStatus as keyof typeof badges] ?? badges.unsettled;

  return (
    <div className="space-y-1">
      <div className="font-mono text-xs text-slate-700">
        {delivery.amountEth} ETH
      </div>
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}
      >
        {badge.label}
      </span>
      {delivery.settlement && (
        <div className="text-xs text-slate-400">
          {delivery.settlement.reason}
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  hint?: string;
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
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
      />
      {hint && (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
