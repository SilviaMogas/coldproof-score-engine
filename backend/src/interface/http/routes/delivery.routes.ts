import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Device } from "../../../domain/device/device.js";
import type { Delivery } from "../../../domain/delivery/delivery.js";
import type { RegisterDelivery } from "../../../application/delivery/register-delivery.js";
import type {
  ListDeliveries,
  DeliveryView,
} from "../../../application/delivery/list-deliveries.js";
import type { DeleteDelivery } from "../../../application/delivery/delete-delivery.js";
import type { StartDelivery } from "../../../application/delivery/start-delivery.js";
import type { FinishDelivery } from "../../../application/delivery/finish-delivery.js";
import type { ConfirmEscrow } from "../../../application/settlement/confirm-escrow.js";
import type { ListAvailableDevices } from "../../../application/delivery/list-available-devices.js";
import { ValidationError } from "../../../shared/errors.js";

const registerBody = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  boxContents: z.string().min(1),
  deviceId: z.string().min(1),
  carrierId: z.string().min(1),
  amountEth: z.coerce.number().nonnegative().optional().default(0),
});

const idParams = z.object({
  id: z.string().min(1),
});

export interface DeliveryRoutesDeps {
  registerDelivery: RegisterDelivery;
  listDeliveries: ListDeliveries;
  deleteDelivery: DeleteDelivery;
  startDelivery: StartDelivery;
  finishDelivery: FinishDelivery;
  confirmEscrow: ConfirmEscrow;
  listAvailableDevices: ListAvailableDevices;
}

/**
 * Delivery management routes (backoffice). All routes require authentication.
 */
export function deliveryRoutes(deps: DeliveryRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get(
      "/deliveries",
      { preHandler: app.authenticate },
      async () => {
        const deliveries = await deps.listDeliveries.execute();
        return { deliveries: deliveries.map(toDto) };
      }
    );

    app.get(
      "/deliveries/available-devices",
      { preHandler: app.authenticate },
      async () => {
        const devices = await deps.listAvailableDevices.execute();
        return { devices: devices.map(toDeviceDto) };
      }
    );

    app.post(
      "/deliveries",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = registerBody.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        const delivery = await deps.registerDelivery.execute(parsed.data);
        reply.code(201);
        return deliveryDto(delivery);
      }
    );

    app.post(
      "/deliveries/:id/start",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = idParams.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        const delivery = await deps.startDelivery.execute(parsed.data.id);
        reply.code(200);
        return deliveryDto(delivery);
      }
    );

    app.post(
      "/deliveries/:id/confirm-escrow",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = idParams.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        const delivery = await deps.confirmEscrow.execute(parsed.data.id);
        reply.code(200);
        return deliveryDto(delivery);
      }
    );

    app.post(
      "/deliveries/:id/finish",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = idParams.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        const delivery = await deps.finishDelivery.execute(parsed.data.id);
        reply.code(200);
        return deliveryDto(delivery);
      }
    );

    app.delete(
      "/deliveries/:id",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = idParams.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        await deps.deleteDelivery.execute(parsed.data.id);
        return reply.code(204).send();
      }
    );
  };
}

function toDto(d: DeliveryView) {
  return {
    id: d.id,
    from: d.from,
    to: d.to,
    boxContents: d.boxContents,
    deviceId: d.deviceId,
    deviceLabel: d.deviceLabel,
    carrierId: d.carrierId,
    carrierName: d.carrierName,
    carrierWalletAddress: d.carrierWalletAddress,
    status: d.status,
    amountEth: d.amountEth,
    settlementStatus: d.settlementStatus,
    settlement: d.settlement,
    createdAt: d.createdAt.toISOString(),
  };
}

/** Serializes a domain delivery for create/start/finish/confirm responses. */
function deliveryDto(d: Delivery) {
  return {
    id: d.id,
    from: d.from,
    to: d.to,
    boxContents: d.boxContents,
    deviceId: d.deviceId,
    carrierId: d.carrierId,
    status: d.status,
    amountEth: d.amountEth,
    settlementStatus: d.settlementStatus,
    settlement: d.settlement,
    createdAt: d.createdAt.toISOString(),
  };
}

function toDeviceDto(d: Device) {
  return {
    deviceId: d.deviceId,
    label: d.label,
    status: d.status,
  };
}
