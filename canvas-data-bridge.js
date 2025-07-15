// Canvas data bridge for MV3 compatibility
// This script will be injected into the contrast-analyzer.html page
// to provide access to the canvas data from the offscreen document

class CanvasDataBridge {
    constructor() {
        this.canvasData = null;
        this.canvas = null;
        this.ready = false;
    }

    async init() {
        // Get canvas data from offscreen document
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'getCanvasData',
                    target: 'offscreen'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response && response.canvasData) {
                this.canvasData = response.canvasData;
                await this.createCanvasFromData();
            }
        } catch (error) {
            console.error('Error getting canvas data:', error);
            // Retry after a short delay
            setTimeout(() => this.init(), 500);
        }
    }

    async createCanvasFromData() {
        if (!this.canvasData) return;

        return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
                this.canvas = document.createElement('canvas');
                this.canvas.width = image.width;
                this.canvas.height = image.height;

                const context = this.canvas.getContext('2d');
                context.drawImage(image, 0, 0);

                this.ready = true;
                resolve();
            };
            image.src = this.canvasData;
        });
    }

    getCanvas() {
        return this.canvas;
    }

    isReady() {
        return this.ready;
    }
}

// Initialize the bridge
const canvasDataBridge = new CanvasDataBridge();

// Make it available globally
window.canvasDataBridge = canvasDataBridge;

// Auto-initialize
canvasDataBridge.init();
