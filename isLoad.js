/*

Read license.txt for licensing information.

*/

// Simple page capturable check for early injection
function isPageCapturable() {
  try {
    // Basic checks for capturable pages
    if (window.location.protocol === 'chrome:' ||
        window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'moz-extension:' ||
        window.location.href.includes('chrome://') ||
        window.location.href.includes('about:')) {
      return false;
    }

    // Check if it's a basic HTML page
    return document.documentElement && document.documentElement.tagName === 'HTML';
  } catch (e) {
    return false;
  }
}

function checkScriptLoad() {
  chrome.runtime.onMessage.addListener(function(request, sender, response) {
    if (request.msg == 'is_page_capturable') {
      try {
        if (isPageCapturable()) {
          response({msg: 'capturable'});
        } else {
          response({msg: 'uncapturable'});
        }
        return true;
      } catch(e) {
        response({msg: 'loading'});
        return true;
      }
    }
    return true;
  });
}
checkScriptLoad();
