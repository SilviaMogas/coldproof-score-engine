import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Device } from "../../../domain/device/device.js";
import type { RegisterDevice } from "../../../application/device/register-device.js";
import type {
  ListDevices,
  DeviceView,
} from "../../../application/device/list-devices.js";
import type { DeleteDevice } from "../../../application/device/delete-device.js";
import { ValidationError } from "../../../shared/errors.js";

const registerBody = z.object({
  deviceId: z.string().min(1),
  publicKey: z.string().min(1),
  label: z.string().min(1),
});

const deviceIdParams = z.object({
  deviceId: z.string().min(1),
});

export interface DeviceRoutesDeps {
  registerDevice: RegisterDevice;
  listDevices: ListDevices;
  deleteDevice: DeleteDevice;
}

/**
 * Device management routes (backoffice). All routes require authentication.
 */
export function deviceRoutes(deps: DeviceRoutesDeps) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get(
      "/devices",
      { preHandler: app.authenticate },
      async () => {
        const devices = await deps.listDevices.execute();
        return { devices: devices.map(toViewDto) };
      }
    );

    app.post(
      "/devices",
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

        const device = await deps.registerDevice.execute(parsed.data);
        reply.code(201);
        return toDto(device);
      }
    );

    app.delete(
      "/devices/:deviceId",
      { preHandler: app.authenticate },
      async (req, reply) => {
        const parsed = deviceIdParams.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join(", ")
          );
        }

        await deps.deleteDevice.execute(parsed.data.deviceId);
        return reply.code(204).send();
      }
    );
  };
}

function toDto(d: Device) {
  return {
    id: d.id,
    deviceId: d.deviceId,
    publicKey: d.publicKey,
    label: d.label,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
  };
}

function toViewDto(d: DeviceView) {
  return {
    ...toDto(d),
    inTransit: d.inTransit,
  };
}
