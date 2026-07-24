import { apiFetch } from "./client";

export type DeliveryStatus = "ready" | "in_transit" | "finished";

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
