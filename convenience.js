const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

function getVersion() {
  try {
    let params = GLib.Variant.new('(ss)',
      ['org.gnome.DisplayManager.Manager', 'Version']);
    let result = Gio.DBus.system.call_sync('org.gnome.DisplayManager',
                                           '/org/gnome/DisplayManager/Manager',
                                           'org.freedesktop.DBus.Properties',
                                           'Get', params, null,
                                           Gio.DBusCallFlags.NONE,
                                           -1, null);

    let version = result.deep_unpack()[0].deep_unpack();
    return version;
  } catch (e) {
    return false;
  }
}
