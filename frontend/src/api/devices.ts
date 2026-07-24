import { apiFetch } from "./client";

export interface DeviceDto {
  id: string;
  deviceId: string;
  publicKey: string;
  label: string;
  status: "active" | "assigned" | "revoked";
  inTransit?: boolean;
  createdAt: string;
}

export interface RegisterDeviceInput {
  deviceId: string;
  publicKey: string;
  label: string;
}

export function listDevices(token: string | undefined): Promise<DeviceDto[]> {
  return apiFetch<{ devices: DeviceDto[] }>("/devices", { token }).then(
    (r) => r.devices
  );
}

export function registerDevice(
  token: string | undefined,
  input: RegisterDeviceInput
): Promise<DeviceDto> {
  return apiFetch<DeviceDto>("/devices", {
    method: "POST",
    body: input,
    token,
  });
}

export function deleteDevice(
  token: string | undefined,
  deviceId: string
): Promise<void> {
  return apiFetch<null>(`/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
    token,
  }).then(() => undefined);
}
