/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Main = imports.ui.main;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const Mainloop = imports.mainloop;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = function(x) { return x; };

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Soup = imports.gi.Soup;

const Metadata = Me.metadata;

const ICON_SIZE = 16;

const SETTINGS_COMPACT_MODE = 'compact-mode';
const SETTINGS_REFRESH_RATE = 'refresh-rate';
const SETTINGS_POSITION = 'position-in-panel';

function _getIPDetails(ipAddr, callback) {

  let _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession,new Soup.ProxyResolverDefault());

  var request = Soup.Message.new('GET', 'http://ipinfo.io/' + ipAddr);

  _httpSession.queue_message(request, function(_httpSession, message) {
    if (message.status_code !== 200) {
      callback(message.status_code, null);
      return;
    }

    var ipDetailsJSON = request.response_body.data;
    var ipDetails = JSON.parse(ipDetailsJSON);
    callback(null, ipDetails);
  });
}

function _getGoogleMapTile(ipData, callback) {

  const Gio = imports.gi.Gio;
  const Soup = imports.gi.Soup;

  // start an http session to make http requests
  let _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession,
                                          new Soup.ProxyResolverDefault());

  // open the file
  let file = Gio.file_new_for_path(Me.path + '/icons/latest_map.png');
  let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

  // start the download
  let request = Soup.Message.new('GET','https://maps.googleapis.com/maps/api/staticmap?center=' + ipData.loc + '&size=150x150&zoom=13&scale=2');
  request.connect('got_chunk', Lang.bind(this, function(message, chunk) {
    // write each chunk to file
    fstream.write(chunk.get_data(), null, chunk.length);
  }));

  _httpSession.queue_message(request, function(_httpSession, message) {
    // close the file
    fstream.close(null);
    callback(null);
  });

}

function _getIP(callback) {

  let _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

  var request = Soup.Message.new('GET', 'http://icanhazip.com');

  _httpSession.queue_message(request, function(_httpSession, message) {
    if (message.status_code !== 200) {
      callback(message.status_code, null);
      return;
    }

    var ipAddrData = request.response_body.data;
    callback(null, ipAddrData);
  });
}

const DEFAULT_DATA = {
  ip: 'No Connection',
  hostname: '',
  city: '',
  region: '',
  country: '',
  loc: '',
  org: '',
  postal: '',
};

const IPMenu = new Lang.Class({ //menu bar item
  Name: 'IPMenu.IPMenu',
  Extends: PanelMenu.Button,
  _init: function() {
    this.parent(0.0, _('IP Details'));
    this._textureCache = St.TextureCache.get_default();

    this._settings = Convenience.getSettings(Me.metadata['settings-schema']);

    this.setPrefs();

    let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box'});

    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(Me.path + '/icons/flags/US.png'),
      icon_size: ICON_SIZE
    });

    this._ipAddr = DEFAULT_DATA.ip;

    this._label = new St.Label({
      text: this._compactMode ? '' : this._ipAddr
    });

    hbox.add_child(this._icon);
    hbox.add_child(this._label);

    this._actor = this.actor.add_actor(hbox);

    //main containers
    let ipInfo = new PopupMenu.PopupBaseMenuItem({reactive: false});
    let parentContainer = new St.BoxLayout(); //main container that holds ip info and map
    //

    //maptile
    this._mapInfo = new St.BoxLayout();
    parentContainer.add_actor(this._mapInfo);

    //default map tile
    this._mapTile = new St.Icon({
      gicon: Gio.icon_new_for_string(Me.path + '/icons/default_map.png'),
      icon_size: 160
    });

    this._mapInfo.add_actor(this._mapTile);
    //

    //ipinfo
    let ipInfoBox = new St.BoxLayout({style_class: 'ip-info-box', vertical: true});
    parentContainer.add_actor(ipInfoBox);
    ipInfo.actor.add(parentContainer);
    this.menu.addMenuItem(ipInfo);

    Object.keys(DEFAULT_DATA).map(function(key) {
      let ipInfoRow = new St.BoxLayout();
      ipInfoBox.add_actor(ipInfoRow);
      ipInfoRow.add_actor(new St.Label({style_class: 'ip-info-key', text: key + ': '}));
      this['_' + key] = new St.Label({style_class: 'ip-info-value', text: DEFAULT_DATA[key]});
      ipInfoRow.add_actor(this['_' + key]);
    });

    let _appSys = Shell.AppSystem.get_default();
    let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');

    let prefs;

    prefs = new PopupMenu.PopupMenuItem(_("Preferences..."));

    prefs.connect('activate', function() {
      if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING) {
        _gsmPrefs.activate();
      } else {
        let info = _gsmPrefs.get_app_info();
        let timestamp = global.display.get_current_time_roundtrip();
        info.launch_uris([Metadata.uuid], global.create_app_launch_context(timestamp, -1));
      }
    });

    this.menu.addMenuItem(prefs);

    this._settings.connect('changed', Lang.bind(this, function() {
      this.setPrefs();
      this.stop();
      this.start(this._refreshRate); //restarts incase refresh rate was updated
      this.resetPanelPos();
      this.update();
    }));


    Main.panel.addToStatusArea('ip-menu', this, 1, this._menuPosition);

    this.update();
    this.start(this._refreshRate);
  },

  destroy: function() {
    this.stop();
    this.parent();
  },

  start: function(timeout) {
    this.timer = Mainloop.timeout_add_seconds(timeout, Lang.bind(this, function() {
      this.update();
      return true;
    }));
  },

  stop: function() {
    if (this.timer) {
      Mainloop.source_remove(this.timer);
    }
  },

  updateMapTile: function() {
    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

    this._mapInfo.destroy_all_children();

    if (parseFloat(Convenience.getVersion()) < 3.16) { //backwards compat with 3.14
      this._mapInfo.add_child(
        this._textureCache.load_uri_async(
        Gio.file_new_for_path(Me.path + '/icons/latest_map.png').get_uri(),
        -1, 160, scaleFactor));
    } else {
      this._mapInfo.add_child(
        this._textureCache.load_file_async(
        Gio.file_new_for_path(Me.path + '/icons/latest_map.png'),
        -1, 160, scaleFactor));
    }

  },

  resetPanelPos: function() {

    Main.panel.statusArea['ip-menu'] = null;
    Main.panel.addToStatusArea('ip-menu', this, 1, this._menuPosition);

  },

  setPrefs: function() {
    this._prevCompactMode = this._compactMode;
    this._prevRefreshRate = this._refreshRate;
    this._prevMenuPosition = this._menuPosition;

    this._compactMode = this._settings.get_boolean(SETTINGS_COMPACT_MODE);
    this._refreshRate = this._settings.get_int(SETTINGS_REFRESH_RATE);
    this._menuPosition = this._settings.get_string(SETTINGS_POSITION);
  },

  update: function() {

    let self = this;

    _getIP(function(err, ipAddr) {

      self._label.text = self._compactMode ? '' : ipAddr; //removes text if it's toggled

      if (ipAddr && (self.ipAddr !== ipAddr)) { //we have an IP, and it's different to before
        self.ipAddr = ipAddr; //changed public IP
        _getIPDetails(ipAddr, function(err, ipData) {
          if (ipData) {
            self._label.text = self._compactMode ? '' : ipData.ip;

            Object.keys(ipData).map(function(key) {
              this['_' + key].text = ipData[key];
            });

            self._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/flags/' + ipData.country + '.png');

            _getGoogleMapTile(ipData, function(err) {
              self.updateMapTile();
            });
          }
        });
      }
    });
  },

});

function init() {

}

let _indicator;

function enable() {
  _indicator = new IPMenu();
}

function disable() {
  _indicator.destroy();
}
