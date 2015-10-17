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

const ICON_SIZE = 16;

function _showPopup(label) {

  let text = new St.Label({style_class: 'helloworld-label', text: label});
  Main.uiGroup.add_actor(text);

  text.opacity = 255;

  let monitor = Main.layoutManager.primaryMonitor;

  text.set_position(monitor.x + Math.floor(monitor.width / 2 - text.width / 2),
                    monitor.y + Math.floor(monitor.height / 2 - text.height / 2));

  Tweener.addTween(text,
                   {opacity: 0,
                     time: 2,
                     transition: 'easeOutQuad',
                     onComplete: function() {
                       Main.uiGroup.remove_actor(text);
                     }});
}

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
  hostname: 'waiting for data',
  city: 'waiting for data',
  region: 'waiting for data',
  country: 'waiting for data',
  loc: 'waiting for data',
  org: 'waiting for data',
  postal: 'waiting for data',
};

const IPMenu = new Lang.Class({ //menu bar item
  Name: 'IPMenu.IPMenu',
  Extends: PanelMenu.Button,
  _init: function() {
    this.parent(0.0, _('Example'));
    this._textureCache = St.TextureCache.get_default();

    let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box'});

    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(Me.path + '/icons/flags/GB.png'),
      icon_size: ICON_SIZE
    });

    this._ipAddr = DEFAULT_DATA.ip;
    this._label = new St.Label({text: this._ipAddr});

    hbox.add_child(this._icon);
    hbox.add_child(this._label);

    this.actor.add_actor(hbox);

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
      if (key !== 'ip') {
        let ipInfoRow = new St.BoxLayout();
        ipInfoBox.add_actor(ipInfoRow);
        ipInfoRow.add_actor(new St.Label({style_class: 'ip-info-key', text: key + ': '}));
        this['_' + key] = new St.Label({style_class: 'ip-info-value', text: DEFAULT_DATA[key]});
        ipInfoRow.add_actor(this['_' + key]);
      }
    });

    this.update();
    this.start();
  },

  destroy: function() {
    this.stop();
    this.parent();
  },

  start: function() {
    this.timer = Mainloop.timeout_add_seconds(30, Lang.bind(this, function() {
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

  update: function() {

    let self = this;

    _getIP(function(err, ipAddr) {
      if (ipAddr && (self.ipAddr !== ipAddr)) { //we have an IP, and it's different to before
        self.ipAddr = ipAddr; //changed public IP
        _getIPDetails(ipAddr, function(err, ipData) {
          if (ipData) {
            self._label.text = ipData.ip;

            Object.keys(ipData).map(function(key) {
              if (key && key !== 'ip') {
                this['_' + key].text = ipData[key];
              }
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

  let pos = 1; //controls the horizontal position; 1 = 1st left, 2 = 2nd left etc

  Main.panel.addToStatusArea('ip-menu', _indicator, pos, 'right');
}

function disable() {
  _indicator.destroy();
}
