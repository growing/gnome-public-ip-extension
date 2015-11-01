/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const SETTINGS_COMPACT_MODE = 'compact-mode';
const SETTINGS_REFRESH_RATE = 'refresh-rate';
const SETTINGS_POSITION = 'position-in-panel';

const IPMenuSettingsWidget = new GObject.Class({
  Name: 'IPMenu.Prefs.IPMenuSettingsWidget',
  GTypeName: 'IPMenuSettingsWidget',
  Extends: Gtk.Grid,

  _init: function() {
    this.parent();
    this.margin = 100; //this is a fudge to get the settings to center as I couldn't work out how to resize the parent dialog
    this.row_spacing = 6;

    this.orientation = Gtk.Orientation.VERTICAL;

    this._settings = Convenience.getSettings(Me.metadata['settings-schema']);

    let vbox = new Gtk.VBox();
    this.add(vbox);

    let checkContainer = new Gtk.HBox({spacing: 5});
    let checkLabel = new Gtk.Label({label: _('Only show flag in Toolbar')});
    let checkButton = new Gtk.CheckButton();

    checkContainer.pack_start(checkLabel, 0,0,0);
    checkContainer.pack_end(checkButton, 0,0,0);

    this._settings.bind(SETTINGS_COMPACT_MODE, checkButton, 'active', Gio.SettingsBindFlags.DEFAULT);

    vbox.add(checkContainer);

    let positionContainer = new Gtk.HBox({spacing: 5});
    let positionLabel = new Gtk.Label({label: _('Toolbar position')});
    let positionSelector = new Gtk.ComboBoxText();

    positionContainer.pack_start(positionLabel, 0,0,0);
    positionContainer.pack_end(positionSelector, 0,0,0);

    ['left','center','right'].forEach(function(item) {
      positionSelector.append_text(item);
    });

    positionSelector.set_active(this._settings.get_enum(SETTINGS_POSITION));

    let self = this;

    positionSelector.connect('changed', function(pos) {
      self._settings.set_enum(SETTINGS_POSITION, positionSelector.get_active());
    });

    vbox.add(positionContainer);

    //
    let frequencyContainer = new Gtk.HBox({spacing: 5});
    let frequencyLabel = new Gtk.Label({label: _('How often to check for IP change (secs)')});
    let frequencySelector = new Gtk.SpinButton();

    frequencyContainer.pack_start(frequencyLabel, 0,0,0);
    frequencyContainer.pack_end(frequencySelector, 0,0,0);

    frequencySelector.set_numeric(true);

    frequencySelector.set_value(this._settings.get_value(SETTINGS_REFRESH_RATE));
    frequencySelector.set_range(30, 30000);
    frequencySelector.set_increments(10,100);

    this._settings.bind(SETTINGS_REFRESH_RATE, frequencySelector, 'value', Gio.SettingsBindFlags.DEFAULT);

    vbox.add(frequencyContainer);

  },
});

function init() {
}

function buildPrefsWidget() {
  let widget = new IPMenuSettingsWidget();
  widget.show_all();

  return widget;
}
