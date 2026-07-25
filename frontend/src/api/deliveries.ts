import { apiFetch } from "./client";

export type DeliveryStatus = "ready" | "in_transit" | "finished";

export type SettlementStatus =
  | "disabled"
  | "awaiting_escrow"
  | "escrowed"
  | "released"
  | "refunded"
  | "unsettled";

export interface SettlementResult {
  verdict: "released" | "refunded" | "unsettled";
  reason: string;
  totalReadings: number;
  violations: number;
  minTempC: number | null;
  maxTempC: number | null;
  paidTo: string | null;
  amountHbar: number;
  transactionId: string | null;
  settledAt: string;
}

export interface DeliveryDto {
  id: string;
  from: string;
  to: string;
  boxContents: string;
  deviceId: string;
  deviceLabel: string | null;
  carrierId: string;
  carrierName: string | null;
  status: DeliveryStatus;
  amountHbar: number;
  settlementStatus: SettlementStatus;
  settlement: SettlementResult | null;
  createdAt: string;
}

export interface AvailableDeviceDto {
  deviceId: string;
  label: string;
  status: "active" | "assigned" | "revoked";
}

export interface RegisterDeliveryInput {
  from: string;
  to: string;
  boxContents: string;
  deviceId: string;
  carrierId: string;
  amountHbar?: number;
}

export function listDeliveries(
  token: string | undefined
): Promise<DeliveryDto[]> {
  return apiFetch<{ deliveries: DeliveryDto[] }>("/deliveries", { token }).then(
    (r) => r.deliveries
  );
}

export function listAvailableDevices(
  token: string | undefined
): Promise<AvailableDeviceDto[]> {
  return apiFetch<{ devices: AvailableDeviceDto[] }>(
    "/deliveries/available-devices",
    { token }
  ).then((r) => r.devices);
}

export function registerDelivery(
  token: string | undefined,
  input: RegisterDeliveryInput
): Promise<DeliveryDto> {
  return apiFetch<DeliveryDto>("/deliveries", {
    method: "POST",
    body: input,
    token,
  });
}

export function deleteDelivery(
  token: string | undefined,
  id: string
): Promise<void> {
  return apiFetch<null>(`/deliveries/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  }).then(() => undefined);
}

export function finishDelivery(
  token: string | undefined,
  id: string
): Promise<DeliveryDto> {
  return apiFetch<DeliveryDto>(
    `/deliveries/${encodeURIComponent(id)}/finish`,
    { method: "POST", token }
  );
}

export function startDelivery(
  token: string | undefined,
  id: string
): Promise<DeliveryDto> {
  return apiFetch<DeliveryDto>(
    `/deliveries/${encodeURIComponent(id)}/start`,
    { method: "POST", token }
  );
}

export function confirmEscrow(
  token: string | undefined,
  id: string
): Promise<DeliveryDto> {
  return apiFetch<DeliveryDto>(
    `/deliveries/${encodeURIComponent(id)}/confirm-escrow`,
    { method: "POST", token }
  );
}
