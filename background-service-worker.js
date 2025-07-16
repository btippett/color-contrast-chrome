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
        this.init();
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
            console.error('Failed to create offscreen document:', error);
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
            const { msg, keyCode } = request;
            const hotKeyEnabled = HotKey.isEnabled();

            switch (msg) {
                case 'capture_hot_key':
                    this.handleHotKey(keyCode);
                    break;
                case 'capture_selected':
                    this.captureSelected();
                    break;
                case 'capture_window':
                    if (hotKeyEnabled) {
                        this.captureWindow();
                    }
                    break;
                case 'capture_area':
                    if (hotKeyEnabled) {
                        this.showSelectionArea();
                    }
                    break;
                case 'capture_webpage':
                    if (hotKeyEnabled) {
                        this.captureWebpage();
                    }
                    break;
                case 'original_view_port_width':
                    // No action needed
                    break;
            }
            return true;
        });
    }

    async sendMessage(message, callback) {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                const [tab] = tabs;
                const response = await chrome.tabs.sendMessage(tab.id, message);
                if (callback) callback(response);
                return response;
            }
        } catch (error) {
            console.error(`Error sending message: ${error}`);
        }
    }

    showSelectionArea() {
        this.sendMessage({
            msg: 'show_selection_area'
        });
    }

    captureScreen() {
        // Screen capture functionality - may need special handling
        console.log('Screen capture requested');
    }

    captureWindow() {
        this.sendMessage({
            msg: 'capture_window'
        }, (response) => this.onResponseVisibleSize(response));
    }

    captureSelected() {
        this.sendMessage({
            msg: 'capture_selected'
        }, (response) => this.onResponseVisibleSize(response));
    }

    captureWebpage() {
        this.sendMessage({
            msg: 'scroll_init'
        }, (response) => this.onResponseVisibleSize(response));
    }

    async onResponseVisibleSize(response) {
        if (!response) return;

        await this.ensureOffscreenDocument();

        switch (response.msg) {
            case 'capture_window':
                this.sendToOffscreen({
                    action: 'captureVisible',
                    data: {
                        docWidth: response.docWidth,
                        docHeight: response.docHeight
                    }
                });
                break;
            case 'scroll_init_done':
                // Store scroll data in chrome.storage.session
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

                setTimeout(() => this.captureAndScroll(), 100);
                break;
            case 'scroll_next_done':
                // Update scroll counts
                const scrollData = await chrome.storage.session.get('scrollData');
                if (scrollData.scrollData) {
                    scrollData.scrollData.scrollXCount = response.scrollXCount;
                    scrollData.scrollData.scrollYCount = response.scrollYCount;
                    await chrome.storage.session.set({scrollData: scrollData.scrollData});
                }
                setTimeout(() => this.captureAndScroll(), 100);
                break;
            case 'scroll_finished':
                this.captureAndScrollDone();
                break;
        }
    }

    async captureSpecialPage() {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png',
                quality: 50
            });

            await this.ensureOffscreenDocument();
            this.sendToOffscreen({
                action: 'processSpecialPage',
                data: { dataUrl }
            });
        } catch (error) {
            console.error('Error capturing special page:', error);
        }
    }

    async capturePortion(x, y, width, height, visibleWidth, visibleHeight, docWidth, docHeight) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png',
                quality: 50
            });

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
            console.error('Error capturing portion:', error);
        }
    }

    async captureVisible(docWidth, docHeight) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png',
                quality: 50
            });

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
            console.error('Error capturing visible area:', error);
        }
    }

    async captureAndScroll() {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
                format: 'png',
                quality: 50
            });
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
            console.error(`Error in captureAndScroll: ${error}`);
        }
    }

    captureAndScrollDone() {
        this.sendToOffscreen({
            action: 'captureAndScrollDone',
            data: {}
        });
    }

    async sendToOffscreen(message) {
        try {
            await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('Error sending to offscreen:', error);
        }
    }

    async postImage() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.tab = tabs[0];

            await chrome.tabs.create({
                url: 'contrast-analyzer.html'
            });
        } catch (error) {
            console.error('Error posting image:', error);
        }
    }

    isThisPlatform(operationSystem) {
        return navigator.userAgent.toLowerCase().indexOf(operationSystem) > -1;
    }

    async executeScriptsInExistingTabs() {
        try {
            const windows = await chrome.windows.getAll();
            for (const win of windows) {
                const tabs = await chrome.tabs.query({ windowId: win.id });
                for (const tab of tabs) {
                    if (!tab.url.startsWith('chrome://')) {
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['page.js']
                            });
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['shortcut.js']
                            });
                        } catch (error) {
                            console.error(`Error executing scripts in tab ${tab.id}: ${error}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error executing scripts in existing tabs: ${error}`);
        }
    }

    async init() {
        // Migrate localStorage to chrome.storage.session
        const savePath = await chrome.storage.session.get('savePath');
        if (!savePath.savePath) {
            await chrome.storage.session.set({ savePath: '' });
        }

        const quality = await chrome.storage.session.get('screenshootQuality');
        if (!quality.screenshootQuality) {
            await chrome.storage.session.set({ screenshootQuality: 'png' });
        }

        await this.executeScriptsInExistingTabs();
        this.addMessageListener();
    }
}

// Initialize the service worker
const screenshot = new ScreenshotServiceWorker();

// Handle offscreen document messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'background') {
        // Handle messages from offscreen document
        switch (message.action) {
            case 'imageProcessed':
                screenshot.postImage();
                break;
            case 'scrollNext': {
                const { visibleWidth, visibleHeight } = message.data;
                screenshot.sendMessage({
                    msg: 'scroll_next',
                    visibleWidth,
                    visibleHeight
                }, response => screenshot.onResponseVisibleSize(response));
                break;
            }
        }
    }
});
