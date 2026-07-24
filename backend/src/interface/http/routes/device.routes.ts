import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Device } from "../../../domain/device/device.js";
import type { RegisterDevice } from "../../../application/device/register-device.js";
import type { ListDevices } from "../../../application/device/list-devices.js";
import { ValidationError } from "../../../shared/errors.js";

const registerBody = z.object({
  deviceId: z.string().min(1),
  publicKey: z.string().min(1),
  label: z.string().min(1),
});

export interface DeviceRoutesDeps {
  registerDevice: RegisterDevice;
  listDevices: ListDevices;
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
        return { devices: devices.map(toDto) };
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
