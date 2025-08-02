# Audio Switch Shortcuts

<div align="center">
  <a href="https://extensions.gnome.org/extension/8150/audio-switch-shortcuts/" >
      <img src="https://img.shields.io/badge/Install%20from-extensions.gnome.org-4A86CF?style=for-the-badge&logo=Gnome&logoColor=white"/>
  </a>
</div>

**Audio Switch Shortcuts** is a simple extension for GNOME 48 and onwards, that allows you to switch speakers
and microphones with global keyboard shortcuts, instead using the mouse to open the Gnome Panel
or navigate menus.

Similar to [Soundswitch](https://github.com/Belphemur/SoundSwitch) for Windows, it allows you to select
specific audio devices to cycle through, using any keyboard shortcut that is convenient to you. Compared to
that application, it does not set a shortcut for muting the microphone, as
this functionality is already provided by GNOME in the Keyboard Shortcuts settings page.

Since this is an extension for the desktop environment, these shortcuts will work on both X11 and Wayland.

## Installation

### Install from GNOME Extensions

The preferred installation method is to use the
[GNOME Extensions](https://extensions.gnome.org/extension/8150/audio-switch-shortcuts/) website. By installing the
extension from there, it can be automatically updated to the newest version.

### Install from published release

You can download the latest release from [the releases page](https://github.com/dbatis/gnome-shell-extension-audio-switch-shortcuts/releases).
Then, you can install using the gnome-extensions tool from the command-line:

```shell
cd <directory-of-download>
/usr/bin/gnome-extensions install audio-switch-shortcuts@dbatis.github.com.zip
/usr/bin/gnome-extensions enable audio-switch-shortcuts@dbatis.github.com
```

You may need to log out of your current session and log back in again for the extension to become available.

### Install from source

Clone this repository in any folder, then:
```shell
cd <repo-folder>
make install
/usr/bin/gnome-extensions enable audio-switch-shortcuts@dbatis.github.com
```

You may need to log out and back in again for the extension to become available.

## Usage

Once the extension is installed, it needs to be configured before it can actually do anything useful. By default,
none of the audio devices are selected to be cycled through when the keyboard shortcuts are pressed. Therefore,
you will need to open the **Preferences** window to set up the extension.

In order to do so, click on the tray icon and select **Preferences...**, or open the Gnome Extensions app, 
find the Audio Switch Shortcuts extension and select **Settings**.

The **Settings** page consists of three tabs. The *Audio Output* and *Audio Input* tabs are similar. They allow
you to select the devices you want to toggle, and the keyboard shortcut. You can also drag around the audio devices that
appear there, so that you can set the order in which they will be cycled through.


The default shortcuts, which can be customized as needed, are:
- `Ctrl + Alt + - (minus sign key)` to switch audio outputs.
- `Ctrl + Alt + = (equal sign key)` to switch audio inputs.

When cycling through devices, any disconnected devices will be ignored. But the extension will remember that they
have been toggled on, so that they become available again when re-connected.

Finally, in the *Settings* tab, you can also set:
- if the tray icon will be visible. If not visible, you can still reach the Settings page through the Gnome Extensions
 application.
- if a short notification will be shown every time you cycle through devices. The notification is temporary
  and will not stay in the Notification Center. Notifications are shown only when a device switch actually occurs.
  So, if you have only toggled on one device, and its already the default device, no notification will be displayed.
  In case you use another extension that
  [renames audio devices](https://extensions.gnome.org/extension/6000/quick-settings-audio-devices-renamer/),
  in the audio panel, Audio Switch Shortcuts will try to use that name instead.
- you may select for the volume on-screen display to appear when switching devices, instead of the notification area.
  In this case, this extension will use the same screen space that is used, for instance, when increasing or
  decreasing the sound volume with the keyboard. This option is disabled if "Snow Notifications" is not enabled.

## Extension removal

If you wish to uninstall this extension, you can do so by running the following commands:

```shell
/usr/bin/gnome-extensions disable audio-switch-shortcuts@dbatis.github.com
rm -rf ~/.local/share/gnome-shell/extensions/audio-switch-shortcuts@dbatis.github.com
```

You can also disable or remove the extension from the Gnome Extensions application.

## Credits

- Code for volume OSD display contributed by [tumist](https://github.com/tumist).
- This program contains code derived from [Tiling Shell](https://github.com/domferr/tilingshell/tree/main),
  authored by Domenico Ferraro. Original code under
  [GPL 2.0 license](https://github.com/domferr/tilingshell/tree/main?tab=GPL-2.0-1-ov-file#readme).
- This program contains code derived from [Quick Settings Audio Devices Hider Gnome Extension](https://github.com/marcinjahn/gnome-quicksettings-audio-devices-hider-extension),
  authored by Marcin Jahn. Original code under
  [MIT License](https://github.com/marcinjahn/gnome-quicksettings-audio-devices-hider-extension?tab=MIT-1-ov-file#readme).
- [Gnome Workbench](https://github.com/workbenchdev/Workbench) has been an invaluable resource to learn
  to program with GNOME technologies.
- Thanks to [uwe-ss](https://github.com/uwe-ss) for the german translation.