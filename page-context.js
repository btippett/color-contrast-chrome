/*

Read license.txt for licensing information.

*/

class ScreenCapturePageContext {
  constructor() {
    this.bodyWrapperDelegate = null;
    this.currentHookStatus = false;
  }

  static clone(object) {
    // Use Object.create for prototype extension
    const newObj = Object.create(object);
    newObj.getInternalObject = function() {
      return Object.getPrototypeOf(this);
    };
    newObj.toString = function() {
      try {
        return Object.getPrototypeOf(this).toString();
      } catch (e) {
        return 'object Object';
      }
    };
    return newObj;
  }

  static bind(newThis, func, ...args) {
    return function() {
      return func.apply(newThis, args);
    };
  }

  scrollValueHooker(_oldValue, _newValue, _reason) {
    // When we hook the value of scrollLeft/Top of body, it always returns 0.
    return 0;
  }

  toggleBodyScrollValueHookStatus() {
    this.currentHookStatus = !this.currentHookStatus;
    if (this.currentHookStatus) {
      try {
        Object.defineProperty(document, 'body', {
          configurable: true,
          get: () => this.bodyWrapperDelegate.getWrapper()
        });
      } catch (e) {
        window.console.error('error', e);
      }
      this.bodyWrapperDelegate.watch('scrollLeft', this.scrollValueHooker.bind(this));
      this.bodyWrapperDelegate.watch('scrollTop', this.scrollValueHooker.bind(this));
    } else {
      this.bodyWrapperDelegate.unwatch('scrollLeft', this.scrollValueHooker.bind(this));
      this.bodyWrapperDelegate.unwatch('scrollTop', this.scrollValueHooker.bind(this));
      try {
        Object.defineProperty(document, 'body', {
          configurable: true,
          get: () => this.bodyWrapperDelegate.getWrapper().getInternalObject()
        });
      } catch (e) {
        window.console.error('error', e);
      }
    }
  }

  checkHookStatus() {
    const needHookScrollValue = document.documentElement.getAttributeNode(
      '__screen_capture_need_hook_scroll_value__');
    const shouldHook = !!(needHookScrollValue && needHookScrollValue.nodeValue === 'true');
    if (this.currentHookStatus !== shouldHook) {
      this.toggleBodyScrollValueHookStatus();
    }
  }

  init() {
    if (!this.bodyWrapperDelegate) {
      this.bodyWrapperDelegate =
        new ScreenCapturePageContext.ObjectWrapDelegate(
          document.body, '^(DOCUMENT_[A-Z_]+|[A-Z_]+_NODE)$');
      document.documentElement.addEventListener(
        '__screen_capture_check_hook_status_event__',
        ScreenCapturePageContext.bind(this, this.checkHookStatus));
    }
  }
}


ScreenCapturePageContext.ObjectWrapDelegate = class {
  constructor(originalObject, propertyNameFilter) {
    this.window_ = window;
    this.wrapper_ = ScreenCapturePageContext.clone(originalObject);
    this.properties_ = [];
    this.watcherTable_ = {};

    if (typeof propertyNameFilter === 'undefined') {
      propertyNameFilter = '';
    } else if (typeof propertyNameFilter !== 'string') {
      try {
        propertyNameFilter = propertyNameFilter.toString();
      } catch (e) {
        propertyNameFilter = '';
      }
    }
    if (propertyNameFilter.length) {
      this.propertyNameFilter_ = new RegExp(propertyNameFilter);
    } else {
      this.propertyNameFilter_ = null;
    }

    // Set the getter and setter for each property
    const setGetterAndSetter = (wrapper, propertyName) => {
      Object.defineProperty(wrapper, propertyName, {
        configurable: true,
        get: () => {
          const internalObj = wrapper.getInternalObject();
          let returnValue = internalObj[propertyName];
          const watchers = this.watcherTable_[propertyName];
          if (watchers) {
            const watchersCache = watchers.concat();
            for (const watcher of watchersCache) {
              if (!watcher) {
                window.console.log(`wrapper's watch for ${propertyName} is unavailable!`);
                continue;
              }
              try {
                returnValue = watcher(returnValue, returnValue, 'get');
              } catch (e) {
                // ignore
              }
            }
          }
          return returnValue;
        },
        set: (value) => {
          const internalObj = wrapper.getInternalObject();
          let userValue = value;
          let oldValue;
          try {
            oldValue = internalObj[propertyName];
          } catch (e) {
            oldValue = null;
          }
          const watchers = this.watcherTable_[propertyName];
          if (watchers) {
            const watchersCache = watchers.concat();
            for (const watcher of watchersCache) {
              if (!watcher) {
                window.console.log(`wrapper's watch for ${propertyName} is unavailable!`);
                continue;
              }
              try {
                userValue = watcher(oldValue, userValue, 'set');
              } catch (e) {
                // ignore
              }
            }
          }
          internalObj[propertyName] = userValue;
        }
      });
    };

    for (const prop in originalObject) {
      if (this.propertyNameFilter_ && this.propertyNameFilter_.test(prop)) {
        continue;
      }
      if (typeof originalObject[prop] !== 'function') {
        this.properties_.push(prop);
        setGetterAndSetter(this.wrapper_, prop);
      }
    }

    this.cleanUp_ = () => {
      this.window_.removeEventListener('unload', this.cleanUp_, false);
      for (const prop of this.properties_) {
        delete this.wrapper_[prop];
      }
      this.window_ = null;
      this.wrapper_ = null;
      this.properties_ = null;
      this.watcherTable_ = null;
      this.propertyNameFilter_ = null;
    };

    this.window_.addEventListener('unload', this.cleanUp_, false);
  }

  getWrapper() {
    return this.wrapper_;
  }

  hasProperty(propertyName) {
    return this.properties_.includes(propertyName);
  }

  watch(propertyName, watchHandler) {
    if (!this.hasProperty(propertyName)) return false;
    let watchers = this.watcherTable_[propertyName];
    if (watchers) {
      if (watchers.includes(watchHandler)) return true;
    } else {
      watchers = [];
      this.watcherTable_[propertyName] = watchers;
    }
    watchers.push(watchHandler);
    return true;
  }

  unwatch(propertyName, watchHandler) {
    if (!this.hasProperty(propertyName)) return false;
    const watchers = this.watcherTable_[propertyName];
    if (watchers) {
      const idx = watchers.indexOf(watchHandler);
      if (idx !== -1) {
        watchers.splice(idx, 1);
        return true;
      }
    }
    return false;
  }
};

const __screenCapturePageContext__ = new ScreenCapturePageContext();
__screenCapturePageContext__.init();
