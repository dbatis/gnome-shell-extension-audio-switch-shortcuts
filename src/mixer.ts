/**
 * The code in this file is heavily based on Marcin Jahn's Gnome extension to hide audio devices from panel.
 *
 * The original code can be found at https://github.com/marcinjahn/gnome-quicksettings-audio-devices-hider-extension/tree/main
 * Original code is licensed under the MIT license (https://github.com/marcinjahn/gnome-quicksettings-audio-devices-hider-extension/blob/main/LICENSE)
 */

import Gvc from "gi://Gvc";
import Gio from "gi://Gio";
import * as Volume from "resource:///org/gnome/shell/ui/status/volume.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DeviceType, StoredDevice } from "./deviceSettings.js";
import { delay } from "./utils.js";

export enum Action {
	ADDED = "ADDED",
	REMOVED = "REMOVED",
}

export interface MixerEvent {
	type: DeviceType;
	action: Action;
	deviceId: number;
}

export interface MixerSubscription {
	ids: number[];
}

/**
 * Represents the id of a device from MixerControl
 */
export type MixerDevice = {
	id: number;
	name: string;
};

export class MixerSource {
	async getMixer(): Promise<Mixer> {
		const mixer = Volume.getMixerControl();

		await waitForMixerToBeReady(mixer);
		await delay(200);

		return new Mixer(mixer, () => {});
	}
}

async function waitForMixerToBeReady(mixer: Gvc.MixerControl): Promise<void> {
	while (mixer.get_state() === Gvc.MixerControlState.CONNECTING) {
		await delay(200);
	}

	const state = mixer.get_state();

	if (state === Gvc.MixerControlState.FAILED) {
		throw new Error("MixerControl is in a failed state");
	} else if (state === Gvc.MixerControlState.CLOSED) {
		throw new Error("MixerControl is in a closed state");
	}
}

export class Mixer {
	constructor(
		private control: Gvc.MixerControl,
		private disposal: () => void,
	) {}

	getAllDevices(type: DeviceType): MixerDevice[] {
		const quickSettings = Main.panel.statusArea.quickSettings;
		if (!quickSettings) {
			return [];
		}
		const devices =
			type === DeviceType.OUTPUT
				? quickSettings._volumeOutput?._output._deviceItems
				: quickSettings._volumeInput?._input._deviceItems;
		if (!devices) {
			return [];
		}
		const ids: number[] = Array.from(devices, ([id]) => id);
		return this.getAudioDevicesFromIds(ids, type);
	}

	getAudioPanelDeviceName(device: StoredDevice): string | undefined {
		try {
			const quickSettings = Main.panel.statusArea.quickSettings;
			const quickSettingsDevices =
				device.type === DeviceType.OUTPUT
					? quickSettings?._volumeOutput?._output._deviceItems
					: quickSettings?._volumeInput?._input._deviceItems;

			return quickSettingsDevices?.get(device.id)?.label.get_text();
		} catch {
			return undefined;
		}
	}

	/**
	 * Get the icon for an audio device. If not found, use generic input or output icon.
	 *
	 * Based on code from tumist at
	 * https://github.com/dbatis/gnome-shell-extension-audio-switch-shortcuts/commit/8df9194f823245945ae70abdff4c3964a615238f
	 *
	 * @param device stored device in extension's settings
	 *
	 * @returns device icon , or generic input/output icon
	 */
	getIcon(device: StoredDevice): Gio.Icon {
		const mixerDevice = this.getUiDeviceFromStoredDevice(device);
		const maybeIconName = mixerDevice?.get_icon_name();

		if (!maybeIconName) {
			// device not found, return generic icon
			return device.type === DeviceType.OUTPUT
				? Gio.ThemedIcon.new_with_default_fallbacks(
						"audio-speakers-symbolic",
					)
				: Gio.ThemedIcon.new_with_default_fallbacks(
						"audio-input-microphone-symbolic",
					);
		} else {
			return Gio.ThemedIcon.new_with_default_fallbacks(
				maybeIconName + "-symbolic",
			);
		}
	}

	/**
	 * Get volume level for an audio device, as a ratio to max volume.
	 *
	 * Based on code from tumist at
	 * https://github.com/dbatis/gnome-shell-extension-audio-switch-shortcuts/commit/8df9194f823245945ae70abdff4c3964a615238f
	 *
	 * @param device stored device in extension's settings
	 *
	 * @returns volume level, or undefined if device not found
	 * */
	getVolume(device: StoredDevice): number | undefined {
		const mixerDevice = this.getUiDeviceFromStoredDevice(device);

		if (!mixerDevice) {
			return undefined;
		} else {
			const stream = this.control.get_stream_from_device(mixerDevice);
			return stream.get_volume() / this.control.get_vol_max_norm();
		}
	}

	/**
	 * Generate a name similar to https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/status/volume.js#L132
	 *
	 * @param device Gvc lookup value
	 * @private
	 */
	private constructDeviceName(device: Gvc.MixerUIDevice) {
		return device.origin
			? `${device.description} - ${device.origin}`
			: device.description;
	}

	getAudioDevicesFromIds(ids: number[], type: DeviceType): MixerDevice[] {
		return this.getUIDevicesFromIds(ids, type).map((device) => {
			return {
				id: device.get_id(),
				name: this.constructDeviceName(device),
			};
		});
	}

	/**
	 * Convert a settings-stored device to Gvc mixer device.
	 *
	 * @param device stored device in extension's settings
	 *
	 * @returns mixer device, if found, null otherwise
	 *
	 * @private
	 */
	private getUiDeviceFromStoredDevice(
		device: StoredDevice,
	): Gvc.MixerUIDevice | null {
		return device.type === DeviceType.OUTPUT
			? this.control.lookup_output_id(device.id)
			: this.control.lookup_input_id(device.id);
	}

	private getUIDevicesFromIds(
		ids: number[],
		type: DeviceType,
	): Gvc.MixerUIDevice[] {
		return ids
			.map((id) =>
				type === DeviceType.OUTPUT
					? this.control.lookup_output_id(id)
					: this.control.lookup_input_id(id),
			)
			.filter((device): device is Gvc.MixerUIDevice => device !== null);
	}

	getDefaultOutput(): string {
		const stream = this.control.get_default_sink();
		return this.constructDeviceName(
			this.control.lookup_device_from_stream(stream),
		);
	}

	getDefaultInput(): string {
		const stream = this.control.get_default_source();
		return this.constructDeviceName(
			this.control.lookup_device_from_stream(stream),
		);
	}

	/**
	 * Set output device. First, try by id. If id not found, try finding it with name.
	 *
	 * @param id device id
	 * @param name display name
	 * @returns true if device changed, false if no device found with this name
	 */
	setOutput(id: number, name: string): boolean {
		let device = this.control.lookup_output_id(id);
		if (!device) {
			const deviceByName = this.getDeviceFromName(
				name,
				DeviceType.OUTPUT,
			);
			if (deviceByName) {
				device = deviceByName;
			}
		}

		if (device) {
			this.control.change_output(device);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Set input device. First, try by id. If id not found, try finding it with name.
	 *
	 * @param id device id
	 * @param name display name
	 * @returns true if device changed, false if no device found with this name
	 */
	setInput(id: number, name: string): boolean {
		let device = this.control.lookup_input_id(id);
		if (!device) {
			const deviceByName = this.getDeviceFromName(name, DeviceType.INPUT);
			if (deviceByName) {
				device = deviceByName;
			}
		}

		if (device) {
			this.control.change_input(device);
			return true;
		} else {
			return false;
		}
	}
	private getDeviceFromName(
		name: string,
		type: DeviceType,
	): Gvc.MixerUIDevice | undefined {
		const quickSettings = Main.panel.statusArea.quickSettings;
		if (!quickSettings) {
			return undefined;
		}

		const deviceItems =
			type === DeviceType.OUTPUT
				? quickSettings._volumeOutput?._output._deviceItems
				: quickSettings._volumeInput?._input._deviceItems;

		if (!deviceItems) {
			return undefined;
		}

		for (const [id] of deviceItems) {
			const device =
				type === DeviceType.OUTPUT
					? this.control.lookup_output_id(id)
					: this.control.lookup_input_id(id);

			if (device && this.constructDeviceName(device) === name) {
				return device;
			}
		}

		return undefined;
	}

	subscribeToDeviceChanges(
		callback: (event: MixerEvent) => void,
	): MixerSubscription {
		const addOutputId = this.control.connect(
			"output-added",
			(_, deviceId) =>
				callback({
					deviceId,
					type: DeviceType.OUTPUT,
					action: Action.ADDED,
				}),
		);
		const removeOutputId = this.control.connect(
			"output-removed",
			(_, deviceId) =>
				callback({
					deviceId,
					type: DeviceType.OUTPUT,
					action: Action.REMOVED,
				}),
		);
		const addInputId = this.control.connect("input-added", (_, deviceId) =>
			callback({
				deviceId,
				type: DeviceType.INPUT,
				action: Action.ADDED,
			}),
		);
		const removeInputId = this.control.connect(
			"input-removed",
			(_, deviceId) =>
				callback({
					deviceId,
					type: DeviceType.INPUT,
					action: Action.REMOVED,
				}),
		);

		return {
			ids: [addOutputId, removeOutputId, addInputId, removeInputId],
		};
	}

	unsubscribe(subscription: MixerSubscription) {
		subscription.ids.forEach((id) => {
			this.control.disconnect(id);
		});
	}

	dispose() {
		this.disposal();
	}
}
