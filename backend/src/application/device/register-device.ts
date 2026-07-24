import type { Device } from "../../domain/device/device.js";
import { createDevice } from "../../domain/device/device.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { ConflictError } from "../../shared/errors.js";

export interface RegisterDeviceInput {
  deviceId: string;
  publicKey: string;
  label: string;
}

/**
 * Registers a new sensor device. Enforces that a deviceId is unique before
 * persisting it.
 */
export class RegisterDevice {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(input: RegisterDeviceInput): Promise<Device> {
    const existing = await this.devices.findByDeviceId(input.deviceId.trim());
    if (existing) {
      throw new ConflictError(
        `device '${input.deviceId}' is already registered`
      );
    }

    const device = createDevice(input);
    await this.devices.save(device);
    return device;
  }
}
