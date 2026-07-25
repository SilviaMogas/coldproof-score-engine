import { apiFetch } from "./client";

export interface CarrierDto {
  id: string;
  name: string;
  hederaAccountId: string | null;
  walletAddress: string | null;
}

export interface RegisterCarrierInput {
  name: string;
  hederaAccountId?: string;
  walletAddress?: string;
}

export function listCarriers(
  token: string | undefined
): Promise<CarrierDto[]> {
  return apiFetch<{ carriers: CarrierDto[] }>("/carriers", {
    token,
  }).then((r) => r.carriers);
}

export function registerCarrier(
  token: string | undefined,
  input: RegisterCarrierInput
): Promise<CarrierDto> {
  return apiFetch<CarrierDto>("/carriers", {
    method: "POST",
    body: input,
    token,
  });
}

export function deleteCarrier(
  token: string | undefined,
  id: string
): Promise<void> {
  return apiFetch<null>(`/carriers/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  }).then(() => undefined);
}
