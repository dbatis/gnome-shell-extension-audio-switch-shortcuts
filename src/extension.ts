import Gio from 'gi://Gio'
import St from 'gi://St'
import Meta from 'gi://Meta'
import Shell from 'gi://Shell'

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js'

import * as Constants from './constants.js'
import {DeviceSettings, DeviceType, StoredDevice} from "./deviceSettings.js"
import {Action, Mixer, MixerSource, MixerSubscription} from "./mixer.js";


export default class AudioSwitchShortCutsExtension extends Extension {
    private gnomeSettings?: Gio.Settings
    private indicator?: PanelMenu.Button
    private deviceSettings?: DeviceSettings
    private mixer?: Mixer
    private mixerSubscription?: MixerSubscription
    private notificationSource?: MessageTray.Source

    enable() {
        this.gnomeSettings = this.getSettings()
        this.deviceSettings = new DeviceSettings(this.gnomeSettings)
        this.taskbarIcon()


        // register available devices, update the stored settings accordingly.
        new MixerSource().getMixer().then(mixer => {
            this.mixer = mixer;

            // set all devices as inactive, so that we re-set their status
            this.deviceSettings?.preStartup()

            // add devices in settings
            this.mixer.getAllDevices(DeviceType.OUTPUT).forEach(device => {
                this.deviceSettings?.addOrEnableDevice(device.name, device.id, DeviceType.OUTPUT)
            })
            this.mixer.getAllDevices(DeviceType.INPUT).forEach(device => {
                this.deviceSettings?.addOrEnableDevice(device.name, device.id, DeviceType.INPUT)
            })

            // remove inactive, non-cycled devices
            this.deviceSettings?.postStartup()

            // listen to devices added or removed
            this.mixerSubscription = this.mixer.subscribeToDeviceChanges(event => {
                const mixerDevice = this.mixer?.getAudioDevicesFromIds([event.deviceId], event.type)

                if (mixerDevice !== undefined) {
                    if (event.action === Action.ADDED) {
                        this.deviceSettings?.addOrEnableDevice(mixerDevice[0].name, mixerDevice[0].id, event.type)
                    } else if (event.action === Action.REMOVED) {
                        this.deviceSettings?.disableDevice(mixerDevice[0].name, event.type)
                    }
                }

            })

            // Add keybindings
            Main.wm.addKeybinding(Constants.KEY_OUTPUT_HOTKEY, this.gnomeSettings!,
                Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
                _ => this.switchToNextDevice(DeviceType.OUTPUT))

            Main.wm.addKeybinding(Constants.KEY_INPUT_HOTKEY, this.gnomeSettings!,
                Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
                _ => this.switchToNextDevice(DeviceType.INPUT))
        })

    }

    /**
     * Get current device, switch to next from settings where active = true, cycled = true
     */
    switchToNextDevice(deviceType: DeviceType) {
        const current = deviceType === DeviceType.OUTPUT
            ? this.mixer!.getDefaultOutput()
            : this.mixer!.getDefaultInput()
        const devices = this.deviceSettings!.getCycledDevices(deviceType)
        if (devices.length == 0) {
            return;
        }

        // find current device in list. If not found or last device, revert to first device in list
        const idx = devices.findIndex(d => d.name === current)
        let found = false
        let newIdx = (idx+1) % devices.length
        while (!found && newIdx != idx) {
            const result = deviceType === DeviceType.OUTPUT
                ? this.mixer!.setOutput(devices[newIdx].id, devices[newIdx].name)
                : this.mixer!.setInput(devices[newIdx].id, devices[newIdx].name)
            if (result) {
                found = true
            } else {
                // try next device
                newIdx = (newIdx+1) % devices.length
            }
        }

        if (found) {
            // if false, device was not found and not changed
            this.sendNotification(devices[newIdx])
        }

    }

    /**
     * Generate a Gnome notification which does not stay permanently in tray, only if notifications are enabled.
     *
     * @param device device that was just enabled
     */
    async sendNotification(device: StoredDevice) {

        if (this.gnomeSettings!.get_boolean(Constants.KEY_NOTIFICATIONS)) {

            if (this.notificationSource && this.notificationSource!.notifications.length > 0) {
                this.notificationSource!.notifications.forEach(n => n.destroy(MessageTray.NotificationDestroyedReason.REPLACED))
            }
            // if notification source does not exist or was just destroyed by the code above, create it
            this.createNotificationSource()

            const title = device.type == DeviceType.INPUT ? _("Audio Input") : _("Audio Output")
            const icon = device.type == DeviceType.INPUT
                ? 'audio-input-microphone-symbolic' : 'audio-speakers-symbolic'
            const message = device.name

            const notification = new MessageTray.Notification({
                source: this.notificationSource,
                title: title,
                body: message,
                iconName: icon,
                urgency: MessageTray.Urgency.NORMAL,
                forFeedback: false,
                resident: false,
                isTransient: true
            })
            this.notificationSource!.addNotification(notification)

        }

    }

    private createNotificationSource() {
        if (this.notificationSource === undefined) {
            const policy = new MessageTray.NotificationGenericPolicy()

            this.notificationSource = new MessageTray.Source({
                title: _('Audio Switch'),
                iconName: 'audio-card-symbolic',
                policy: policy,
            })

            this.notificationSource.connect('destroy', _ => {
                this.notificationSource = undefined
            })
            Main.messageTray.add(this.notificationSource)
        }
    }

    taskbarIcon() {
        this.indicator = new PanelMenu.Button(0, this.metadata.name, false)

        const icon = new St.Icon({
            icon_name: 'audio-card-symbolic',
            style_class: 'system-status-icon',
        })
        this.indicator.add_child(icon)

        Main.panel.addToStatusArea(this.uuid, this.indicator)

        const menu = new PopupMenu.PopupMenu(this.indicator, 0.5, St.Side.TOP)

        // Add a menu item to open the preferences window
        menu.addAction(_('Preferences...'), () => this.openPreferences())
        this.indicator.setMenu(menu)

        // Create a new GSettings object, and bind the "show-indicator"
        // setting to the "visible" property.
        this.gnomeSettings = this.getSettings()
        this.gnomeSettings.bind('show-indicator', this.indicator, 'visible',
            Gio.SettingsBindFlags.DEFAULT)

    }

    disable() {
        Main.wm.removeKeybinding(Constants.KEY_OUTPUT_HOTKEY)
        Main.wm.removeKeybinding(Constants.KEY_INPUT_HOTKEY)

        this.deviceSettings = undefined
        this.gnomeSettings = undefined

        if (this.mixerSubscription) {
            this.mixer?.unsubscribe(this.mixerSubscription)
            this.mixerSubscription = undefined
        }
        this.mixer?.dispose()
        this.mixer = undefined

        this.indicator?.destroy()
        this.indicator = undefined

        if (this.notificationSource) {
            this.notificationSource = undefined
        }
    }

}