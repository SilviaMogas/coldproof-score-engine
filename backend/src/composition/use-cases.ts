import type { SignatureVerifier } from "../application/ports/signature-verifier.js";
import type { Repositories } from "./repositories.js";
import { RegisterDevice } from "../application/device/register-device.js";
import { ListDevices } from "../application/device/list-devices.js";
import { DeleteDevice } from "../application/device/delete-device.js";
import { RegisterCarrier } from "../application/carrier/register-carrier.js";
import { ListCarriers } from "../application/carrier/list-carriers.js";
import { DeleteCarrier } from "../application/carrier/delete-carrier.js";
import { RegisterDelivery } from "../application/delivery/register-delivery.js";
import { ListDeliveries } from "../application/delivery/list-deliveries.js";
import { DeleteDelivery } from "../application/delivery/delete-delivery.js";
import { StartDelivery } from "../application/delivery/start-delivery.js";
import { FinishDelivery } from "../application/delivery/finish-delivery.js";
import { ListAvailableDevices } from "../application/delivery/list-available-devices.js";
import { IngestReading } from "../application/reading/ingest-reading.js";
import { ListReadings } from "../application/reading/list-readings.js";

/** Every application use case, wired to its dependencies. */
export interface UseCases {
  registerDevice: RegisterDevice;
  listDevices: ListDevices;
  deleteDevice: DeleteDevice;
  registerCarrier: RegisterCarrier;
  listCarriers: ListCarriers;
  deleteCarrier: DeleteCarrier;
  registerDelivery: RegisterDelivery;
  listDeliveries: ListDeliveries;
  deleteDelivery: DeleteDelivery;
  startDelivery: StartDelivery;
  finishDelivery: FinishDelivery;
  listAvailableDevices: ListAvailableDevices;
  ingestReading: IngestReading;
  listReadings: ListReadings;
}

/**
 * Wires the use cases to the repositories and services. This is the single
 * place where application-layer dependencies are injected.
 */
export function createUseCases(
  repos: Repositories,
  signatureVerifier: SignatureVerifier
): UseCases {
  const { devices, carriers, deliveries, readings } = repos;
  return {
    registerDevice: new RegisterDevice(devices),
    listDevices: new ListDevices(devices, deliveries),
    deleteDevice: new DeleteDevice(devices),
    registerCarrier: new RegisterCarrier(carriers),
    listCarriers: new ListCarriers(carriers),
    deleteCarrier: new DeleteCarrier(carriers),
    registerDelivery: new RegisterDelivery(deliveries, devices, carriers),
    listDeliveries: new ListDeliveries(deliveries, devices, carriers),
    deleteDelivery: new DeleteDelivery(deliveries, devices),
    startDelivery: new StartDelivery(deliveries),
    finishDelivery: new FinishDelivery(deliveries, devices),
    listAvailableDevices: new ListAvailableDevices(devices),
    ingestReading: new IngestReading(readings, devices, signatureVerifier),
    listReadings: new ListReadings(readings),
  };
}
