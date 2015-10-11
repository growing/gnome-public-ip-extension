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

const EXAMPLE_ICON_SIZE = 16;

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

const IPMenuItem = new Lang.Class({
  Name: 'IPMenuItem',
  Extends: PopupMenu.PopupBaseMenuItem,

  _init: function(info) {
    this.parent();
    this._info = info;

    this._icon = new St.Icon({ gicon: info.icon,
      icon_size: EXAMPLE_ICON_SIZE });
    this.actor.add_child(this._icon);

    this._label = new St.Label({ text: info.name });
    this.actor.add_child(this._label);
    this.update();
    this.start();
  },

  destroy: function() {
    if (this._changedId) {
      this._info.disconnect(this._changedId);
      this._changedId = 0;
    }
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
    if(this.timer){
      Mainloop.source_remove(this.timer);
    }
  },

  update: function() {
    _getIP(function(err, ipAddr){
      _getIPDetails(ipAddr, function(err,ipData){
        setText(ipData.ip);
      });
    });

    // this.parent(event);
  },

  _propertiesChanged: function(info) {
    this._icon.gicon = info.icon;
    this._label.text = info.name;
  },
});

const SECTIONS = [
  'one',
  'two',
  'three',
  'four'
]

const IPMenu = new Lang.Class({
  Name: 'IPMenu.IPMenu',
  Extends: PanelMenu.Button,
  _init: function() {
    this.parent(0.0, _("Example"));

    let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });

    this._label = new St.Label({ text: '42.42.42.42' });

    hbox.add_child(this._label);

    this.actor.add_actor(hbox);


    this._sections = { };

    for (let i=0; i < SECTIONS.length; i++) {
      let id = SECTIONS[i];
      this._sections[id] = new PopupMenu.PopupMenuSection();

      this.menu.addMenuItem(this._sections[id]);

      let menuItem = new IPMenuItem({name:SECTIONS[i], icon: new Gio.ThemedIcon({ name: 'drive-harddisk-symbolic' })});

      this._sections[id].addMenuItem(menuItem);

      this._sections[id].actor.visible = true;

    }
  },

  destroy: function() {
    this.parent();
  },

  setText: function(text) {
     this._label.text = text;
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

function setText(text) {
  _indicator.setText(text);
}
