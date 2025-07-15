/*

Read license.txt for licensing information.

*/

var HotKey = (function() {
  // In-memory storage for MV3 service worker compatibility
  var memoryStorage = {
    'hot_key_enabled': 'true',
    'area_capture_hot_key': 'R',
    'viewport_capture_hot_key': 'V',
    'fullpage_capture_hot_key': 'H',
    'screen_capture_hot_key': 'P'
  };

  return {
    setup: function(plugin) {
      // For MV3 compatibility, we use defaults without localStorage
      var screenCaptureHotKey = this.get('screen');
      if (this.isEnabled() &&
          plugin && !plugin.setHotKey(screenCaptureHotKey.charCodeAt(0))) {
        this.set('screen', '@'); // Disable hot key for screen capture.
      }
    },

    /**
     * Set hot key by type.
     * @param {String} type Hot key type, must be area/viewport/fullpage/screen.
     * @param {String} value
     */
    set: function(type, value) {
      var key = type + '_capture_hot_key';
      memoryStorage[key] = value;
    },

    get: function(type) {
      return memoryStorage[type + '_capture_hot_key'] || '';
    },

    getCharCode: function(type) {
      return this.get(type).charCodeAt(0);
    },

    enable: function() {
      memoryStorage['hot_key_enabled'] = 'true';
    },

    disable: function(bg) {
      memoryStorage['hot_key_enabled'] = 'false';
      if (bg && bg.plugin) {
        bg.plugin.disableScreenCaptureHotKey();
      }
    },

    isEnabled: function() {
      return memoryStorage['hot_key_enabled'] === 'true';
    }
  }
})();
