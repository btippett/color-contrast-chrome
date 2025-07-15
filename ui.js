/*

Read license.txt for licensing information.

*/

class UI {
  static show(element) {
    if (UI.getStyle(element, 'display') === 'none') {
      // Set display value to be defined by style sheet
      const cssRules = window.getMatchedCSSRules(element, '', true);
      const ruleLength = cssRules.length;
      let display;
      for (let i = ruleLength - 1; i >= 0; --i) {
        display = cssRules[i].style.display;
        if (display && display !== 'none') {
          element.style.display = display;
          return;
        }
      }

      // Set display value to be UA default value
      const tmpElement = document.createElement(element.nodeName);
      document.body.appendChild(tmpElement);
      display = UI.getStyle(tmpElement, 'display');
      document.body.removeChild(tmpElement);
      element.style.display = display;
    }
  }

  static hide(element) {
    element.style.display = 'none';
  }

  static setStyle(element, ...args) {
    if (args.length === 1 && typeof args[0] === 'object') {
      for (const prop in args[0]) {
        const camelCasedProp = prop.replace(/-([a-z])/gi, (n, letter) => letter.toUpperCase());
        element.style[camelCasedProp] = args[0][prop];
      }
    } else if (args.length === 2) {
      element.style[args[0]] = args[1];
    }
  }

  static getStyle(element, property) {
    return window.getComputedStyle(element)[property];
  }

  static addClass(element, className) {
    const classes = element.className.split(' ');
    classes.push(className);
    element.className = classes.join(' ');
  }

  static removeClass(element, className) {
    const classes = element.className.split(' ');
    const index = classes.indexOf(className);
    if (index >= 0) {
      classes.splice(index, 1);
      element.className = classes.join(' ');
    }
  }

  static addStyleSheet(path) {
    const link = document.createElement('link');
    link.setAttribute('type', 'text/css');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', path);
    document.head.appendChild(link);
  }
}