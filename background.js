/*

Read license.txt for licensing information.

*/

// Import HotKey utilities
importScripts('hotkey_storage.js');

// Service Worker for Manifest V3
class ScreenshotServiceWorker {
    constructor() {
        this.tab = 0;
        this.captureStatus = true;
        this.offscreenCreated = false;
        this.lastCaptureTime = 0;
        this.minCaptureInterval = 600; // Minimum 600ms between captures
        // Don't call init() here, let the event listeners handle it
        this.addMessageListener();
    }

    async createOffscreenDocument() {
        if (this.offscreenCreated) return;
        try {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['DOM_SCRAPING'],
                justification: 'Canvas manipulation and image processing for screenshot functionality'
            });
            this.offscreenCreated = true;
        } catch (error) {
            console.error(`Failed to create offscreen document:`, error);
        }
    }

    async ensureOffscreenDocument() {
        if (!this.offscreenCreated) {
            await this.createOffscreenDocument();
        }
    }

    handleHotKey(keyCode) {
        if (HotKey.isEnabled()) {
            switch (keyCode) {
                case HotKey.getCharCode('area'):
                    this.showSelectionArea();
                    break;
                case HotKey.getCharCode('viewport'):
                    this.captureWindow();
                    break;
                case HotKey.getCharCode('fullpage'):
                    this.captureWebpage();
                    break;
                case HotKey.getCharCode('screen'):
                    this.captureScreen();
                    break;
            }
        }
    }

    addMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log(`Service worker received message:`, request);
            const obj = request;
            const hotKeyEnabled = HotKey.isEnabled();
            const isFromPopup = !sender.tab;

            console.log(`Message details:`, {
                msg: obj.msg,
                isFromPopup,
                hotKeyEnabled,
                senderTab: sender.tab
            });

            // Handle messages from offscreen document (these have both target and action)
            if (obj.target === 'background' && obj.action) {
                switch (obj.action) {
                    case 'imageProcessed':
                        screenshot.postImage();
                        break;
                    case 'scrollNext':
                        screenshot.sendMessage({
                            msg: 'scroll_next',
                            visibleWidth: obj.data.visibleWidth,
                            visibleHeight: obj.data.visibleHeight
                        }, response => screenshot.onResponseVisibleSize(response));
                        break;
                }
                return true;
            }

            // Handle getCanvasData requests to offscreen document
            if (obj.target === 'offscreen' && obj.action === 'getCanvasData') {
                this.sendToOffscreen(obj)
                    .then(response => sendResponse(response))
                    .catch(error => {
                        console.error(`Error forwarding getCanvasData request:`, error);
                        sendResponse({ error: 'Failed to get canvas data' });
                    });
                return true;
            }

            // Handle messages targeting the offscreen document
            if (obj.target === 'offscreen' && obj.action) {
                console.log(`Routing message to offscreen document:`, obj);
                chrome.runtime.sendMessage(obj, response => {
                    console.log(`Offscreen response:`, response);
                    if (sendResponse) sendResponse(response);
                });
                return true;
            }

            // Handle messages from popup or content scripts
            console.log(`Checking message type: ${obj.msg} against switch cases`);
            switch (obj.msg) {
                case 'test_connection':
                    console.log(`Test connection message received`);
                    sendResponse({ status: 'connected', timestamp: Date.now() });
                    break;
                case 'capture_hot_key':
                    console.log(`Handling hotkey capture`);
                    this.handleHotKey(obj.keyCode);
                    break;
                case 'capture_selected':
                    console.log(`Handling selected capture`);
                    this.captureSelected();
                    break;
                case 'capture_window':
                    console.log(`Handling window capture - executing captureWindow()`);
                    if (isFromPopup || hotKeyEnabled) {
                        console.log(`Calling this.captureWindow()`);
                        this.captureWindow();
                    } else {
                        console.log(`Capture blocked - isFromPopup: ${isFromPopup}, hotKeyEnabled: ${hotKeyEnabled}`);
                    }
                    break;
                case 'capture_area':
                    console.log(`Handling area capture - executing showSelectionArea()`);
                    if (isFromPopup || hotKeyEnabled) {
                        console.log(`Calling this.showSelectionArea()`);
                        this.showSelectionArea();
                    } else {
                        console.log(`Area capture blocked - isFromPopup: ${isFromPopup}, hotKeyEnabled: ${hotKeyEnabled}`);
                    }
                    break;
                case 'capture_webpage':
                    console.log(`Handling webpage capture - executing captureWebpage()`);
                    if (isFromPopup || hotKeyEnabled) {
                        console.log(`Calling this.captureWebpage()`);
                        this.captureWebpage();
                    } else {
                        console.log(`Webpage capture blocked - isFromPopup: ${isFromPopup}, hotKeyEnabled: ${hotKeyEnabled}`);
                    }
                    break;
                case 'capture_screen':
                    console.log(`Handling screen capture`);
                    this.captureScreen();
                    break;
                case 'capture_special_page':
                    console.log(`Handling special page capture`);
                    this.captureSpecialPage();
                    break;
                case 'original_view_port_width':
                    sendResponse(null);
                    break;
                default:
                    console.log(`Unknown message: ${obj.msg}`);
                    break;
            }
            return true;
        });
    }

    async sendMessage(message, callback) {
        try {
            console.log(`Sending message to content script:`, message);
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                const { id, url } = tabs[0];
                console.log(`Sending message to tab: ${id}, ${url}`);
                const response = await chrome.tabs.sendMessage(id, message);
                console.log(`Content script response:`, response);
                if (callback) callback(response);
                return response;
            }
        } catch (error) {
            console.error(`Error sending message to content script:`, error);
        }
    }

    showSelectionArea() {
        this.sendMessage({ msg: 'show_selection_area' });
    }

    captureScreen() {
        // Screen capture functionality - may need special handling
        console.log(`Screen capture requested`);
    }

    captureWindow() {
        console.log(`captureWindow() method called`);
        this.sendMessage({ msg: 'capture_window' }, response => this.onResponseVisibleSize(response));
    }

    captureSelected() {
        this.sendMessage({ msg: 'capture_selected' }, response => this.onResponseVisibleSize(response));
    }

    captureWebpage() {
        this.sendMessage({ msg: 'scroll_init' }, response => this.onResponseVisibleSize(response));
    }

    async onResponseVisibleSize(response) {
        console.log(`onResponseVisibleSize called with response:`, response);
        if (!response) {
            console.log(`No response received from content script`);
            return;
        }

        await this.ensureOffscreenDocument();

        switch (response.msg) {
            case 'capture_window': {
                console.log(`Processing capture_window response, capturing screenshot...`);
                try {
                    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 50 });
                    console.log(`Screenshot captured, sending to offscreen...`);
                    this.sendToOffscreen({
                        action: 'captureVisible',
                        data: {
                            dataUrl,
                            docWidth: response.docWidth,
                            docHeight: response.docHeight
                        }
                    });
                } catch (error) {
                    console.error(`Error capturing screenshot:`, error);
                }
                break;
            }
            case 'scroll_init_done': {
                await chrome.storage.session.set({
                    scrollData: {
                        startX: response.startX,
                        startY: response.startY,
                        scrollX: response.scrollX,
                        scrollY: response.scrollY,
                        canvasWidth: response.canvasWidth,
                        canvasHeight: response.canvasHeight,
                        visibleHeight: response.visibleHeight,
                        visibleWidth: response.visibleWidth,
                        scrollXCount: response.scrollXCount,
                        scrollYCount: response.scrollYCount,
                        docWidth: response.docWidth,
                        docHeight: response.docHeight,
                        zoom: response.zoom
                    }
                });
                setTimeout(() => this.captureAndScroll(), 800);
                break;
            }
            case 'scroll_next_done': {
                const { scrollData } = await chrome.storage.session.get('scrollData');
                if (scrollData) {
                    scrollData.scrollXCount = response.scrollXCount;
                    scrollData.scrollYCount = response.scrollYCount;
                    await chrome.storage.session.set({ scrollData });
                }
                setTimeout(() => this.captureAndScroll(), 800);
                break;
            }
            case 'scroll_finished': {
                this.captureAndScrollDone();
                break;
            }
        }
    }

    async captureSpecialPage() {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 50 });
            await this.ensureOffscreenDocument();
            this.sendToOffscreen({ action: 'processSpecialPage', data: { dataUrl } });
        } catch (error) {
            console.error(`Error capturing special page:`, error);
        }
    }

    async capturePortion(x, y, width, height, visibleWidth, visibleHeight, docWidth, docHeight) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 50 });
            await this.ensureOffscreenDocument();
            this.sendToOffscreen({
                action: 'capturePortion',
                data: {
                    dataUrl,
                    x, y, width, height,
                    visibleWidth, visibleHeight,
                    docWidth, docHeight
                }
            });
        } catch (error) {
            console.error(`Error capturing portion:`, error);
        }
    }

    async captureVisible(docWidth, docHeight) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 50 });
            await this.ensureOffscreenDocument();
            this.sendToOffscreen({
                action: 'captureVisible',
                data: {
                    dataUrl,
                    docWidth,
                    docHeight
                }
            });
        } catch (error) {
            console.error(`Error capturing visible area:`, error);
        }
    }

    async captureAndScroll() {
        try {
            const now = Date.now();
            const timeSinceLastCapture = now - this.lastCaptureTime;
            if (timeSinceLastCapture < this.minCaptureInterval) {
                const waitTime = this.minCaptureInterval - timeSinceLastCapture;
                console.log(`Rate limiting: waiting ${waitTime}ms before next capture`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            console.log(`Capturing screenshot for full page...`);
            this.lastCaptureTime = Date.now();
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 50 });
            const { scrollData } = await chrome.storage.session.get('scrollData');
            await this.ensureOffscreenDocument();
            this.sendToOffscreen({
                action: 'captureAndScroll',
                data: {
                    dataUrl,
                    scrollData
                }
            });
        } catch (error) {
            console.error(`Error in captureAndScroll:`, error);
            if (error.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
                console.log(`Rate limit exceeded, waiting 3 seconds before retry...`);
                setTimeout(() => this.captureAndScroll(), 3000);
            }
        }
    }

    captureAndScrollDone() {
        this.sendToOffscreen({ action: 'captureAndScrollDone', data: {} });
    }

    async sendToOffscreen(message) {
        console.log(`Sending message to offscreen document:`, message);
        try {
            await chrome.runtime.sendMessage(message);
            console.log(`Message sent to offscreen successfully`);
        } catch (error) {
            console.error(`Error sending to offscreen:`, error);
        }
    }

    async postImage() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.tab = tabs[0];
            await chrome.storage.session.set({ tabTitle: tabs[0].title });
            await chrome.tabs.create({ url: 'contrast-analyzer.html' });
        } catch (error) {
            console.error(`Error posting image:`, error);
        }
    }

    isThisPlatform(operationSystem) {
        return navigator.userAgent.toLowerCase().includes(operationSystem);
    }

    async executeScriptsInExistingTabs() {
        try {
            const windows = await chrome.windows.getAll();
            for (const win of windows) {
                const tabs = await chrome.tabs.query({ windowId: win.id });
                for (const tab of tabs) {
                    const { url, status, id } = tab;
                    if (!url ||
                        url.startsWith('chrome://') ||
                        url.startsWith('chrome-extension://') ||
                        url.startsWith('moz-extension://') ||
                        url.startsWith('about:') ||
                        url.startsWith('edge://') ||
                        url.startsWith('opera://') ||
                        status !== 'complete') {
                        continue;
                    }
                    try {
                        await chrome.scripting.executeScript({ target: { tabId: id }, files: ['page.js'] });
                        await chrome.scripting.executeScript({ target: { tabId: id }, files: ['shortcut.js'] });
                    } catch (error) {
                        if (error.message.includes('Cannot access') ||
                            error.message.includes('error page') ||
                            error.message.includes('chrome://') ||
                            error.message.includes('restricted')) {
                            continue;
                        }
                        console.warn(`Unexpected error executing scripts in tab: ${id}, ${url}, ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error executing scripts in existing tabs:`, error);
        }
    }

    async init() {
        HotKey.setup(null);
        const savePath = await chrome.storage.session.get('savePath');
        if (!savePath.savePath) {
            await chrome.storage.session.set({ savePath: '' });
        }
        const quality = await chrome.storage.session.get('screenshootQuality');
        if (!quality.screenshootQuality) {
            await chrome.storage.session.set({ screenshootQuality: 'png' });
        }
        setTimeout(() => {
            this.executeScriptsInExistingTabs();
        }, 1000);
    }
}

// Initialize the service worker
const screenshot = new ScreenshotServiceWorker();

// Add immediate activation for testing
console.log('Service worker starting up...');

// Service worker event listeners
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed/updated:', details.reason);
    // Initialize the service worker
    await screenshot.init();
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('Extension startup');
    // Initialize the service worker
    await screenshot.init();
});

// Initialize immediately to activate the service worker
screenshot.init().then(() => {
    console.log('Service worker initialized successfully');
}).catch(error => {
    console.error('Service worker initialization failed:', error);
});