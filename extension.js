/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const Mainloop = imports.mainloop;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = function(x) { return x; }

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Soup = imports.gi.Soup;

const ICON_SIZE = 16;

function _showPopup(label) {

    text = new St.Label({ style_class: 'helloworld-label', text: label});
    Main.uiGroup.add_actor(text);

    text.opacity = 255;

    let monitor = Main.layoutManager.primaryMonitor;

    text.set_position(monitor.x + Math.floor(monitor.width / 2 - text.width / 2),
                      monitor.y + Math.floor(monitor.height / 2 - text.height / 2));

    Tweener.addTween(text,
                     { opacity: 0,
                       time: 2,
                       transition: 'easeOutQuad',
                       onComplete: function() {
                         Main.uiGroup.remove_actor(text);
                       } });
}

function _getIPDetails(ipAddr, callback) {

  let _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

  var request = Soup.Message.new('GET','http://ipinfo.io/' + ipAddr);

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

function _getIP(callback) {

  let _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

  var request = Soup.Message.new('GET','http://icanhazip.com');

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
  ip: "42.42.42.42",
  hostname: "a23-66-166-151.deploy.static.akamaitechnologies.com",
  city: "Cambridge",
  region: "Massachusetts",
  country: "US",
  loc: "42.3626,-71.0843",
  org: "AS16625 Akamai Technologies, Inc.",
  postal: "02142"
};

const IPMenu = new Lang.Class({ //menu bar item
  Name: 'IPMenu.IPMenu',
  Extends: PanelMenu.Button,
  _init: function() {
    this.parent(0.0, _("Example"));

    let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });

    this._icon = new St.Icon({
      gicon: Gio.icon_new_for_string(Me.path + '/icons/flags/GB.png'),
      icon_size: ICON_SIZE
    });

    this._label = new St.Label({ text: DEFAULT_DATA.ip });

    hbox.add_child(this._icon);
    hbox.add_child(this._label);

    this.actor.add_actor(hbox);

    //main containers
    let ipInfo = new PopupMenu.PopupBaseMenuItem({reactive: false});
    let parentContainer = new St.BoxLayout(); //main container that holds ip info and map
    //

    //maptile
    let mapInfo = new St.BoxLayout();
    parentContainer.add_actor(mapInfo);

    this._mapTile = new St.Icon({
      style_class: 'map-tile',
      gicon: Gio.icon_new_for_string(Me.path + '/icons/default_map.png'),
      icon_size: 160
    });

    mapInfo.add_actor(this._mapTile);
    //

    //ipinfo
    let ipInfoBox = new St.BoxLayout({ style_class: 'ip-info-box', vertical: true});
    parentContainer.add_actor(ipInfoBox);
    ipInfo.actor.add(parentContainer);
    this.menu.addMenuItem(ipInfo);

    Object.keys(DEFAULT_DATA).map(function(key){
      if(key !== 'ip'){
        let ipInfoRow = new St.BoxLayout();
        ipInfoBox.add_actor(ipInfoRow);
        this['_'+key] = DEFAULT_DATA[key];
        ipInfoRow.add_actor(new St.Label({ style_class: 'ip-info-key', text: key + ': ' }));
        ipInfoRow.add_actor(new St.Label({ style_class: 'ip-info-value', text: DEFAULT_DATA[key] }));
      }
    });
    //

    this.update();
    this.start();
  },

  destroy: function() {
    this.stop();
    this.parent();
  },

  setLabel: function(ipData) {
     this._label.text = ipData.ip;
     this._icon.gicon = Gio.icon_new_for_string(Me.path + '/icons/flags/'+ipData.country+'.png');
  },

  start: function() {
    this.timer = Mainloop.timeout_add_seconds(30, Lang.bind(this, function() {
  		this.update();
  		return true;
  	}));
  },

  stop: function() {
    if(this.timer){
      Mainloop.source_remove(this.timer);
    }
  },

  update: function() {
    _getIP(function(err, ipAddr){
      _getIPDetails(ipAddr, function(err,ipData){
        setLabel(ipData);
      });
    });
  },

});

function init() {

}

let _indicator;

function enable() {
  _indicator = new IPMenu;

  let pos = 1; //controls the horizontal position; 1 = 1st left, 2 = 2nd left etc

  Main.panel.addToStatusArea('ip-menu', _indicator, pos, 'right');
}

function disable() {
  _indicator.destroy();
}

function setLabel(text) {
  _indicator.setLabel(text);
}
