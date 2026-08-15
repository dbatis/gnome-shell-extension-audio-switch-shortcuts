/**
 * The code in this file is a fork from Marcin Jahn's Gnome extension to hide audio devices from panel.
 *
 * The original code can be found at https://github.com/marcinjahn/gnome-quicksettings-audio-devices-hider-extension/tree/main
 * Original code is licensed under the MIT license (https://github.com/marcinjahn/gnome-quicksettings-audio-devices-hider-extension/blob/main/LICENSE)
 */

import GLib from "gi://GLib";

export function range(amount: number): number[] {
	return [...Array(amount).keys()];
}

let timeoutSourceIds: number[] | null = [];

export function delay(milliseconds: number) {
	return new Promise((resolve) => {
		const timeoutId = GLib.timeout_add(
			GLib.PRIORITY_DEFAULT,
			milliseconds,
			() => {
				removeFinishedTimeoutId(timeoutId);
				resolve(undefined);

				return GLib.SOURCE_REMOVE;
			},
		);

		if (!timeoutSourceIds) {
			timeoutSourceIds = [];
		}
		timeoutSourceIds.push(timeoutId);
	});
}

function removeFinishedTimeoutId(timeoutId: number) {
	timeoutSourceIds?.splice(timeoutSourceIds.indexOf(timeoutId), 1);
}

export function disposeDelayTimeouts() {
	timeoutSourceIds?.forEach((sourceId) => {
		GLib.Source.remove(sourceId);
	});

	timeoutSourceIds = null;
}
