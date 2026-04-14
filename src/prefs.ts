import Gio from 'gi://Gio'
import Adw from 'gi://Adw'
import Gtk from 'gi://Gtk'
import Gdk from "gi://Gdk";
import GObject from "gi://GObject";

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'

import * as Constants from './constants.js'
import {DeviceSettings, DeviceType} from "./deviceSettings.js";
import {buildShortcutButtonRow} from "./keymapButton.js";
import BindingFlags = GObject.BindingFlags;

export default class AudioSwitchShortcutsPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const extensionSettings = this.getSettings()
        const deviceSettings = new DeviceSettings(extensionSettings)

        window.add(this.outputPage(extensionSettings, deviceSettings))
        window.add(this.inputPage(extensionSettings, deviceSettings))
        window.add(this.miscPage(extensionSettings))

        return Promise.resolve()
    }

    outputPage(extensionSettings: Gio.Settings, deviceSettings: DeviceSettings): Adw.PreferencesPage {

        const page = new Adw.PreferencesPage({
            title: _('Audio Outputs'),
            icon_name: 'audio-speakers-symbolic',
        })

        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Audio Output Shortcuts')
        })
        page.add(shortcutGroup)

        const keyboardRow = buildShortcutButtonRow(
            Constants.KEY_OUTPUT_HOTKEY,
            extensionSettings,
            _('Keyboard shortcut'),
            _('Switch to next audio output device'),
        );
        shortcutGroup.add(keyboardRow)

        const devicesGroup = new Adw.PreferencesGroup({
            title: _('Audio Devices'),
            description: _('Select the devices to cycle through when the keyboard shortcut is pressed. Drag them to set the order.')
        })
        page.add(devicesGroup)

        const listBox = new Gtk.ListBox({css_classes: ['boxed-list']})
        devicesGroup.add(listBox)

        this.createDeviceList(listBox, deviceSettings, DeviceType.OUTPUT)

        return page
    }
    
    inputPage(extensionSettings: Gio.Settings, deviceSettings: DeviceSettings): Adw.PreferencesPage {

        const page = new Adw.PreferencesPage({
            title: _('Audio Inputs'),
            icon_name: 'audio-input-microphone-symbolic',
        })

        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Audio Input Shortcuts')
        })
        page.add(shortcutGroup)

        const keyboardRow = buildShortcutButtonRow(
            Constants.KEY_INPUT_HOTKEY,
            extensionSettings,
            _('Keyboard shortcut'),
            _('Switch to next audio input device'),
        );
        shortcutGroup.add(keyboardRow)

        const devicesGroup = new Adw.PreferencesGroup({
            title: _('Audio Devices'),
            description: _('Select the devices to cycle through when the keyboard shortcut is pressed. Drag them to set the order.')
        })
        page.add(devicesGroup)

        const listBox = new Gtk.ListBox({css_classes: ['boxed-list']})
        devicesGroup.add(listBox)

        this.createDeviceList(listBox, deviceSettings, DeviceType.INPUT)

        return page
    }

    private createDeviceList(group: Gtk.ListBox, deviceSettings: DeviceSettings, deviceType: DeviceType) {

        const rowList: Adw.SwitchRow[] = [] // used later on for drag-and-drop

        deviceSettings.getActiveDevices(deviceType).forEach(device => {
            const row = new Adw.SwitchRow({
                title: device.name,
                active: device.cycled
            })
            row.add_prefix(new Gtk.Image({
                icon_name: 'list-drag-handle-symbolic',
                css_classes: ['dim-label']
            }))
            row.connect('notify::active', source => {
                deviceSettings.setCycled(device.name, device.type, source.get_active())
            })

            group.append(row)
            rowList.push(row)
        })

        // add drag-and-drop capability, code based on GNOME Workbench example
        const dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow.$gtype, Gdk.DragAction.MOVE);
        group.add_controller(dropTarget)

        // Drag:
        for (const row of rowList) {
            let drag_x: number
            let drag_y: number

            const dropController = new Gtk.DropControllerMotion()

            const dragSource = new Gtk.DragSource({
                actions: Gdk.DragAction.MOVE
            })

            row.add_controller(dragSource)
            row.add_controller(dropController)

            dragSource.connect('prepare', (_source, x, y) => {
                drag_x = x
                drag_y = y

                const value = new GObject.Value()
                value.init(Gtk.ListBoxRow.$gtype)
                value.set_object(row)

                return Gdk.ContentProvider.new_for_value(value)
            })

            dragSource.connect('drag-begin', (_source, drag) => {
                const dragWidget = new Gtk.ListBox
                dragWidget.set_size_request(row.get_width(), row.get_height())
                dragWidget.add_css_class('boxed-list')

                const dragRow = new Adw.SwitchRow({title: row.title, active: row.active})
                dragRow.add_prefix(
                    new Gtk.Image({iconName: 'list-drag-handle-symbolic', css_classes: ['dim-label']})
                )
                dragWidget.append(dragRow)
                dragWidget.drag_highlight_row(dragRow)

                const icon = Gtk.DragIcon.get_for_drag(drag)
                icon.child = dragWidget

                drag.set_hotspot(drag_x, drag_y)
            })

            dropController.connect("enter", () => {
                group.drag_highlight_row(row);
            });

            dropController.connect("leave", () => {
                group.drag_unhighlight_row();
            });
        }

        // Drop:
        dropTarget.connect('drop', (_drop, value: Adw.SwitchRow, _x, y) => {
            const targetRow = group.get_row_at_y(y)
            const targetIndex = targetRow?.get_index()

            if (value && targetRow ) {
                group.remove(value)
                group.insert(value, targetIndex!)
                targetRow.set_state_flags(Gtk.StateFlags.NORMAL, true)
                deviceSettings.reorderDevice(value.title, deviceType, targetIndex!)
                return true
            } else {
                return false
            }
        })

    }

    miscPage(extensionSettings: Gio.Settings): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('Settings'),
            icon_name: 'applications-system-symbolic',
        })

        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of this extension'),
        })
        page.add(group)

        // Create a new preferences row
        const indicator = new Adw.SwitchRow({
            title: _('Show Indicator'),
            subtitle: _('Show a tray icon, to get to settings quicker'),
        })
        group.add(indicator)

        const notifications = new Adw.SwitchRow({
            title: _('Show Notifications'),
            subtitle: _('Display a notification message when you press a shortcut'),
        })
        group.add(notifications)

        const osd = new Adw.SwitchRow({
            title: _('Use Volume OSD for notifications'),
            subtitle: _('Instead of the notification area, use the volume on-screen display area when switching devices.'),
        })
        notifications.bind_property('active', osd, 'sensitive', null)
        group.add(osd)

        const audio = new Adw.SwitchRow({
            title: _('Play sound on device change'),
            subtitle: _('Play an audible alert when switching devices')
        })
        group.add(audio)

        extensionSettings!.bind(Constants.KEY_INDICATOR, indicator, 'active', Gio.SettingsBindFlags.DEFAULT)
        extensionSettings!.bind(Constants.KEY_NOTIFICATIONS, notifications, 'active', Gio.SettingsBindFlags.DEFAULT)
        extensionSettings!.bind(Constants.KEY_SHOW_VOLUME_OSD, osd, 'active', Gio.SettingsBindFlags.DEFAULT)
        extensionSettings!.bind(Constants.KEY_PLAY_AUDIO_ALERT, audio, 'active', Gio.SettingsBindFlags.DEFAULT)

        // enable/disable OSD setting. This line needs to be here after bindings,
        // else it will not initialise properly when dialog first appears.
        osd.set_sensitive(extensionSettings.get_boolean(Constants.KEY_NOTIFICATIONS))

        return page
    }
    
}