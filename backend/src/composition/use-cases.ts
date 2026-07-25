import type { SignatureVerifier } from "../application/ports/signature-verifier.js";
import type { ConsensusLog } from "../application/ports/consensus-log.js";
import type { CommandSigner } from "../application/ports/command-signer.js";
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
import { SealDelivery } from "../application/delivery/seal-delivery.js";
import { ListAvailableDevices } from "../application/delivery/list-available-devices.js";
import { ConfirmEscrow } from "../application/settlement/confirm-escrow.js";
import { SettleDelivery } from "../application/settlement/settle-delivery.js";
import type { SettlementServices } from "./settlement.js";
import { IngestReading } from "../application/reading/ingest-reading.js";
import { ListReadings } from "../application/reading/list-readings.js";
import {
  AuthorizeUnlock,
  type UnlockPolicy,
} from "../application/unlock/authorize-unlock.js";

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
  sealDelivery: SealDelivery;
  confirmEscrow: ConfirmEscrow;
  listAvailableDevices: ListAvailableDevices;
  ingestReading: IngestReading;
  listReadings: ListReadings;
  authorizeUnlock: AuthorizeUnlock;
}

/**
 * Wires the use cases to the repositories and services. This is the single
 * place where application-layer dependencies are injected.
 */
export function createUseCases(
  repos: Repositories,
  signatureVerifier: SignatureVerifier,
  consensusLog: ConsensusLog,
  commandSigner: CommandSigner,
  unlockPolicy: UnlockPolicy,
  settlement: SettlementServices
): UseCases {
  const { devices, carriers, deliveries, readings } = repos;
  const settleDelivery = new SettleDelivery(
    deliveries,
    settlement.escrow,
    settlement.config
  );
  const finishDelivery = new FinishDelivery(deliveries, devices, settleDelivery);
  const startDelivery = new StartDelivery(deliveries, settlement.escrow);
  return {
    registerDevice: new RegisterDevice(devices),
    listDevices: new ListDevices(devices, deliveries),
    deleteDevice: new DeleteDevice(devices),
    registerCarrier: new RegisterCarrier(carriers),
    listCarriers: new ListCarriers(carriers),
    deleteCarrier: new DeleteCarrier(carriers),
    registerDelivery: new RegisterDelivery(
      deliveries,
      devices,
      carriers,
      settlement.config.enabled
    ),
    listDeliveries: new ListDeliveries(deliveries, devices, carriers),
    deleteDelivery: new DeleteDelivery(
      deliveries,
      devices,
      settlement.escrow,
      settlement.config.enabled
    ),
    startDelivery,
    finishDelivery,
    sealDelivery: new SealDelivery(
      devices,
      deliveries,
      signatureVerifier,
      startDelivery
    ),
    confirmEscrow: new ConfirmEscrow(
      deliveries,
      carriers,
      settlement.escrow,
      settlement.config
    ),
    listAvailableDevices: new ListAvailableDevices(devices),
    ingestReading: new IngestReading(
      readings,
      devices,
      deliveries,
      signatureVerifier,
      consensusLog,
      finishDelivery,
      { minTempC: unlockPolicy.minTempC, maxTempC: unlockPolicy.maxTempC },
      settlement.config.enabled
    ),
    listReadings: new ListReadings(readings),
    authorizeUnlock: new AuthorizeUnlock(
      devices,
      deliveries,
      readings,
      signatureVerifier,
      commandSigner,
      unlockPolicy,
      finishDelivery
    ),
  };
}
