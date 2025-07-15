/*

 Read license.txt for licensing information.

 */

const trapEnterKey = (obj, evt, f) => {
    // if enter key pressed
    if (evt.which === 13) {
        f();
        evt.preventDefault();
    }
};

const $ = (id) => document.getElementById(id);

const isWindowsOrLinuxPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('windows') || ua.includes('linux');
};

const isWindowsOrLinux = isWindowsOrLinuxPlatform();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.msg === 'page_capturable') {
        $('tip').style.display = 'none';
        $('captureSpecialPageItem').style.display = 'none';
        if (isWindowsOrLinux) {
            // ...existing code...
        }
        $('captureWindowItem').style.display = 'block';
        $('captureAreaItem').style.display = 'block';
        $('captureWebpageItem').style.display = 'block';
    } else if (request.msg === 'page_uncapturable') {
        i18nReplace('tip', 'special');
        if (isWindowsOrLinux) {
            // ...existing code...
        } else {
            $('tip').style.display = 'block';
        }
        $('captureSpecialPageItem').style.display = 'none';
        $('captureWindowItem').style.display = 'none';
        $('captureAreaItem').style.display = 'none';
        $('captureWebpageItem').style.display = 'none';
    }
    return true;
});

const toDo = (what) => {
    console.log(`Popup sending message: ${what}`);

    chrome.runtime.sendMessage({
        msg: what,
        target: 'background'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error(`Error sending message: ${chrome.runtime.lastError.message}`);
        } else {
            console.log('Message sent successfully, response:', response);
        }
    });

    switch (what) {
        case 'capture_screen':
        case 'capture_window':
        case 'capture_area':
        case 'capture_special_page':
            window.close();
            break;
        case 'capture_webpage':
            $('loadDiv').style.display = 'block';
            $('item').style.display = 'none';
            break;
    }
};

const i18nReplace = (id, name) => $(id).innerHTML = chrome.i18n.getMessage(name);

const resizeDivWidth = (id, width) => {
    $(id).style.width = `${width}px`;
};

const init = () => {
    console.log('Popup initialized, testing service worker connection...');

    chrome.runtime.sendMessage({
        msg: 'test_connection',
        target: 'background'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error(`Service worker connection test failed: ${chrome.runtime.lastError.message}`);
        } else {
            console.log('Service worker connection test successful:', response);
        }
    });

    i18nReplace('captureSpecialPageText', 'capture_window_warning');
    i18nReplace('capturing', 'capturing');
    i18nReplace('captureScreenText', 'capture_screen');
    i18nReplace('captureWindowText', 'capture_window');
    i18nReplace('captureAreaText', 'capture_area');
    i18nReplace('captureWebpageText', 'capture_webpage');
    i18nReplace('optionItem', 'option');

    $('option').addEventListener('click', () => {
        chrome.tabs.create({ url: 'options.html' });
    }, false);

    $('option').addEventListener('keydown', function(e) {
        trapEnterKey(this, e, () => {
            chrome.tabs.create({ url: 'options.html' });
        });
    }, false);

    if (HotKey.isEnabled()) {
        $('captureWindowShortcut').style.display = 'inline';
        $('captureAreaShortcut').style.display = 'inline';
        $('captureWebpageShortcut').style.display = 'inline';
        if (isWindowsOrLinux)
            $('captureScreenShortcut').style.display = 'inline';
        document.body.style.minWidth = '190px';
    } else {
        $('captureWindowShortcut').style.display = 'none';
        $('captureAreaShortcut').style.display = 'none';
        $('captureWebpageShortcut').style.display = 'none';
        if (isWindowsOrLinux)
            $('captureScreenShortcut').style.display = 'none';
        document.body.style.minWidth = '140px';
    }

    let isScriptLoad = false;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].url.indexOf('chrome') === 0 || tabs[0].url.indexOf('about') === 0) {
            i18nReplace('tip', 'special');
            if (isWindowsOrLinux) {
                // ...existing code...
            }
            return;
        } else {
            $('tip').style.display = 'none';
            $('captureSpecialPageItem').style.display = 'block';
            if (isWindowsOrLinux) {
                // ...existing code...
            }
            showOption();
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { msg: 'is_page_capturable' }, (response) => {
                isScriptLoad = true;
                if (response.msg === 'capturable') {
                    $('tip').style.display = 'none';
                    if (isWindowsOrLinux) {
                        // ...existing code...
                    }
                    $('captureSpecialPageItem').style.display = 'none';
                    $('captureWindowItem').style.display = 'block';
                    $('captureAreaItem').style.display = 'block';
                    $('captureWebpageItem').style.display = 'block';
                    const textWidth = $('captureWindowText').scrollWidth;
                    resizeDivWidth('captureWindowText', textWidth);
                    resizeDivWidth('captureAreaText', textWidth);
                    resizeDivWidth('captureWebpageText', textWidth);
                } else if (response.msg === 'uncapturable') {
                    i18nReplace('tip', 'special');
                    if (isWindowsOrLinux) {
                        // ...existing code...
                    } else {
                        $('tip').style.display = 'block';
                    }
                } else {
                    i18nReplace('tip', 'loading');
                }
            });
        });
    });

    const insertScript = () => {
        if (!isScriptLoad) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0].url.indexOf('chrome') === 0 || tabs[0].url.indexOf('about') === 0) {
                    i18nReplace('tip', 'special');
                } else {
                    $('tip').style.display = 'none';
                    $('captureSpecialPageItem').style.display = 'block';
                    showOption();
                }
            });
            if (isWindowsOrLinux) {
                // ...existing code...
            }
        }
        const captureItems = document.querySelectorAll('li.menuI');
        let showSeparator = false;
        for (let i = 0; i < captureItems.length; i++) {
            if (window.getComputedStyle(captureItems[i]).display !== 'none') {
                showSeparator = true;
                break;
            }
        }
        $('separatorItem').style.display = showSeparator ? 'block' : 'none';
    };

    setTimeout(insertScript, 500);

    // Update hot key.
    if (HotKey.get('area') !== '@')
        $('captureAreaShortcut').innerText = `Ctrl+Alt+${HotKey.get('area')}`;
    if (HotKey.get('viewport') !== '@') {
        $('captureWindowShortcut').innerText = `Ctrl+Alt+${HotKey.get('viewport')}`;
    }
    if (HotKey.get('fullpage') !== '@') {
        $('captureWebpageShortcut').innerText = `Ctrl+Alt+${HotKey.get('fullpage')}`;
    }
    if (HotKey.get('screen') !== '@')
        $('captureScreenShortcut').innerText = `Ctrl+Alt+${HotKey.get('screen')}`;

    if (isWindowsOrLinux) {
        showOption();
    }

    $('captureSpecialPageItem').addEventListener('click', () => {
        toDo('capture_special_page');
    });
    $('captureSpecialPageItem').addEventListener('keydown', function(e) {
        trapEnterKey(this, e, () => {
            toDo('capture_special_page');
        });
    });
    $('captureAreaItem').addEventListener('click', () => {
        toDo('capture_area');
    });
    $('captureAreaItem').addEventListener('keydown', function(e) {
        trapEnterKey(this, e, () => {
            toDo('capture_area');
        });
    });
    $('captureWindowItem').addEventListener('click', () => {
        toDo('capture_window');
    });
    $('captureWindowItem').addEventListener('keydown', function(e) {
        trapEnterKey(this, e, () => {
            toDo('capture_window');
        });
    });
    $('captureWebpageItem').addEventListener('click', () => {
        toDo('capture_webpage');
    });
    $('captureWebpageItem').addEventListener('keydown', function(e) {
        trapEnterKey(this, e, () => {
            toDo('capture_webpage');
        });
    });
    $('captureScreenItem').addEventListener('click', () => {
        toDo('capture_screen');
    });
    $('captureScreenItem').addEventListener('keydown', function(e) {
        trapEnterKey(this, e, () => {
            toDo('capture_screen');
        });
    });
};

const showOption = () => {
    $('option').style.display = 'block';
    $('separatorItem').style.display = 'block';
};

document.addEventListener('DOMContentLoaded', init);
