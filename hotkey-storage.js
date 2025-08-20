
// Read license.txt for licensing information.

class HotKey {
  static memoryStorage = {
    hot_key_enabled: 'true',
    area_capture_hot_key: 'R',
    viewport_capture_hot_key: 'V',
    fullpage_capture_hot_key: 'H',
    screen_capture_hot_key: 'P',
  };

  static setup(plugin) {
    // For MV3 compatibility, we use defaults without localStorage
    const screenCaptureHotKey = HotKey.get('screen');
    if (HotKey.isEnabled() && plugin && !plugin.setHotKey(screenCaptureHotKey.charCodeAt(0))) {
      HotKey.set('screen', '@'); // Disable hot key for screen capture.
    }
  }

  /**
   * Set hot key by type.
   * @param {String} type Hot key type, must be area/viewport/fullpage/screen.
   * @param {String} value
   */
  static set(type, value) {
    const key = `${type}_capture_hot_key`;
    HotKey.memoryStorage[key] = value;
  }

  static get(type) {
    return HotKey.memoryStorage[`${type}_capture_hot_key`] || '';
  }

  static getCharCode(type) {
    return HotKey.get(type).charCodeAt(0);
  }

  static enable() {
    HotKey.memoryStorage.hot_key_enabled = 'true';
  }

  static disable(bg) {
    HotKey.memoryStorage.hot_key_enabled = 'false';
    if (bg?.plugin) {
      bg.plugin.disableScreenCaptureHotKey();
    }
  }

  static isEnabled() {
    return HotKey.memoryStorage.hot_key_enabled === 'true';
  }
}
