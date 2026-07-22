import Gio from "gi://Gio";

import * as Constants from "./constants.js";

export enum DeviceType {
  INPUT = "INPUT",
  OUTPUT = "OUTPUT",
}

/**
 * Represents an audio device and its cycling status.
 */
export type StoredDevice = {
  id: number;
  name: string;
  type: DeviceType;
  cycled: boolean;
  active: boolean;
};

/**
 * Utility to handle settings for the audio switcher.
 *
 * This class only handles the complex case of storing available audio inputs and outputs. Simpler
 * settings (such as whether to show the indicator or notifications) are handled separately
 * by extension.ts and prefs.ts.
 */
export class DeviceSettings {
  private extensionSettings: Gio.Settings;

  constructor(settings: Gio.Settings) {
    this.extensionSettings = settings;
  }

  getActiveDevices(deviceType: DeviceType) {
    return this.load(deviceType).filter(
      (d) => d.type === deviceType && d.active,
    );
  }

  getCycledDevices(deviceType: DeviceType) {
    return this.load(deviceType).filter(
      (d) => d.type === deviceType && d.active && d.cycled,
    );
  }

  /**
   * Should be used only on startup. This will set all devices as disabled. In the next step,
   * for each active device `addOrEnableDevice` should be called, and then the `postStartup()`
   * method should be called, which will remove inactive, uncycled devices.
   */
  preStartup() {
    const devices = this.loadAll();
    for (const device of devices) {
      device.active = false;
    }
    this.store(devices);
  }

  /**
   * Remove devices that were not re-activated during startup, and do not participate in
   * the keyboard shortcut switching devices.
   */
  postStartup() {
    const devices = this.loadAll();
    const newArray: StoredDevice[] = [];
    for (const device of devices) {
      if (device.active || device.cycled) {
        newArray.push(device);
      }
    }
    this.store(devices);
  }

  /**
   * Add a new input device with the given name mark it as cycled: false, active: true.
   * If the device already exists in settings, update its id and mark it as active.
   */
  addOrEnableDevice(name: string, id: number, deviceType: DeviceType) {
    const devices = this.loadAll();
    const existingDevice = devices.find(
      (d) => d.name === name && d.type === deviceType,
    );
    if (!existingDevice) {
      // device not found, append it and store in settings
      devices.push({
        id: id,
        name: name,
        type: deviceType,
        cycled: false,
        active: true,
      });
    } else {
      // this updates the array value as well
      existingDevice.active = true;
      existingDevice.id = id;
    }
    this.store(devices);
  }

  disableDevice(name: string, deviceType: DeviceType) {
    const devices = this.loadAll();
    const existingDevice = devices.find(
      (d) => d.name === name && d.type === deviceType,
    );
    if (existingDevice) {
      existingDevice.active = false;
    }
    this.store(devices);
  }

  /**
   * Update active and cycled fields of device in settings. Does nothing if the device
   * was not found already in settings.
   */
  setCycled(name: string, deviceType: DeviceType, cycled: boolean) {
    const devices = this.loadAll();
    const existingDevice = devices.find(
      (d) => d.name === name && d.type === deviceType,
    );
    if (existingDevice) {
      existingDevice.cycled = cycled;
      this.store(devices);
    }
  }

  /**
   * Remove the device from its current position, add it in the new position. Should only be used for active devices.
   *
   * @param name device to alter.
   * @param type device type
   * @param newPosition zero-based index of new position, relative to devices of same type
   */
  reorderDevice(name: string, type: DeviceType, newPosition: number) {
    const devices = this.loadAll();

    // find device. If not found, ignore
    const device = devices.find((d) => d.name === name && d.type === type);
    if (!device || !device.active) {
      // guard against misuse
      return;
    }

    const newArray: StoredDevice[] = [];
    let deviceCount = 0;
    let wasPlacedInLoop = false;
    for (const storedDevice of devices) {
      if (
        storedDevice.name === device.name &&
        storedDevice.type === device.type
      ) {
        continue;
        // do nothing, we essentially remove it from new array
      }
      if (storedDevice.type === device.type && storedDevice.active) {
        // active device, increase counter and check if we must place the device there
        deviceCount++;
        if (!wasPlacedInLoop && deviceCount > newPosition) {
          newArray.push(device);
          wasPlacedInLoop = true;
        }
      }
      newArray.push(storedDevice);
    }

    // if it was not placed in loop, because it will be last item, add it now
    if (!wasPlacedInLoop) {
      newArray.push(device);
    }
    this.store(newArray);
  }

  private load(deviceType: DeviceType): StoredDevice[] {
    return JSON.parse(
      this.extensionSettings.get_string(Constants.KEY_AUDIO_DEVICES),
    ).filter((d: StoredDevice) => d.type === deviceType);
  }

  private loadAll(): StoredDevice[] {
    return JSON.parse(
      this.extensionSettings.get_string(Constants.KEY_AUDIO_DEVICES),
    );
  }

  private store(value: StoredDevice[]) {
    this.extensionSettings.set_string(
      Constants.KEY_AUDIO_DEVICES,
      JSON.stringify(value),
    );
  }
}
