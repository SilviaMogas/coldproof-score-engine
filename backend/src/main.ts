import { loadEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";
import type { DeviceRepository } from "./domain/device/device-repository.js";
import { InMemoryDeviceRepository } from "./infrastructure/persistence/in-memory-device-repository.js";
import { SqliteDeviceRepository } from "./infrastructure/persistence/sqlite-device-repository.js";
import type { CarrierRepository } from "./domain/carrier/carrier-repository.js";
import { InMemoryCarrierRepository } from "./infrastructure/persistence/in-memory-carrier-repository.js";
import { SqliteCarrierRepository } from "./infrastructure/persistence/sqlite-carrier-repository.js";
import type { DeliveryRepository } from "./domain/delivery/delivery-repository.js";
import { InMemoryDeliveryRepository } from "./infrastructure/persistence/in-memory-delivery-repository.js";
import { SqliteDeliveryRepository } from "./infrastructure/persistence/sqlite-delivery-repository.js";
import { CognitoTokenVerifier } from "./infrastructure/auth/cognito-token-verifier.js";
import { RegisterDevice } from "./application/device/register-device.js";
import { ListDevices } from "./application/device/list-devices.js";
import { DeleteDevice } from "./application/device/delete-device.js";
import { RegisterCarrier } from "./application/carrier/register-carrier.js";
import { ListCarriers } from "./application/carrier/list-carriers.js";
import { DeleteCarrier } from "./application/carrier/delete-carrier.js";
import { RegisterDelivery } from "./application/delivery/register-delivery.js";
import { ListDeliveries } from "./application/delivery/list-deliveries.js";
import { DeleteDelivery } from "./application/delivery/delete-delivery.js";
import { StartDelivery } from "./application/delivery/start-delivery.js";
import { FinishDelivery } from "./application/delivery/finish-delivery.js";
import { ListAvailableDevices } from "./application/delivery/list-available-devices.js";
import { buildServer } from "./interface/http/server.js";

/**
 * Composition root: build every concrete dependency once and wire the layers
 * together, then start the HTTP server.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  });

  // Adapters (infrastructure).
  const deviceRepository: DeviceRepository =
    env.PERSISTENCE === "sqlite"
      ? new SqliteDeviceRepository(env.SQLITE_PATH)
      : new InMemoryDeviceRepository();
  const carrierRepository: CarrierRepository =
    env.PERSISTENCE === "sqlite"
      ? new SqliteCarrierRepository(env.SQLITE_PATH)
      : new InMemoryCarrierRepository();
  const deliveryRepository: DeliveryRepository =
    env.PERSISTENCE === "sqlite"
      ? new SqliteDeliveryRepository(env.SQLITE_PATH)
      : new InMemoryDeliveryRepository();
  logger.info({ persistence: env.PERSISTENCE }, "device repository ready");
  const verifier = new CognitoTokenVerifier({
    userPoolId: env.COGNITO_USER_POOL_ID,
    clientId: env.COGNITO_CLIENT_ID,
    tokenUse: env.COGNITO_TOKEN_USE,
  });

  // Use cases (application).
  const registerDevice = new RegisterDevice(deviceRepository);
  const listDevices = new ListDevices(deviceRepository);
  const deleteDevice = new DeleteDevice(deviceRepository);
  const registerCarrier = new RegisterCarrier(
    carrierRepository
  );
  const listCarriers = new ListCarriers(carrierRepository);
  const deleteCarrier = new DeleteCarrier(carrierRepository);
  const registerDelivery = new RegisterDelivery(
    deliveryRepository,
    deviceRepository,
    carrierRepository
  );
  const listDeliveries = new ListDeliveries(
    deliveryRepository,
    deviceRepository,
    carrierRepository
  );
  const deleteDelivery = new DeleteDelivery(deliveryRepository, deviceRepository);
  const startDelivery = new StartDelivery(deliveryRepository);
  const finishDelivery = new FinishDelivery(
    deliveryRepository,
    deviceRepository
  );
  const listAvailableDevices = new ListAvailableDevices(deviceRepository);

  const app = await buildServer({
    logger,
    corsOrigin: env.CORS_ORIGIN,
    verifier,
    registerDevice,
    listDevices,
    deleteDevice,
    registerCarrier,
    listCarriers,
    deleteCarrier,
    registerDelivery,
    listDeliveries,
    deleteDelivery,
    startDelivery,
    finishDelivery,
    listAvailableDevices,
  });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}

void main();
