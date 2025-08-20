// offscreen.js
// Handles all DOM, canvas, and image processing for screenshot functionality in Manifest V3

// Global canvas for image processing
let globalCanvas = null;

// Create and manage the global canvas
const createCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'processImage': {
        const result = await processImage(message.data);
        sendResponse({ result });
        break;
      }
      case 'capturePortion': {
        const portionResult = await handleCapturePortion(message.data);
        sendResponse({ result: portionResult });
        break;
      }
      case 'captureVisible': {
        await handleCaptureVisible(message.data);
        break;
      }
      case 'processSpecialPage': {
        await handleProcessSpecialPage(message.data);
        break;
      }
      case 'captureAndScroll': {
        await handleCaptureAndScroll(message.data);
        break;
      }
      case 'captureAndScrollDone': {
        await handleCaptureAndScrollDone(message.data);
        break;
      }
      case 'stitchImages': {
        const stitchResult = await stitchImages(message.data);
        sendResponse({ result: stitchResult });
        break;
      }
      case 'getCanvasData': {
        const canvasData = getCanvasDataURL();
        sendResponse({ canvasData });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Error in offscreen message handler:', error);
    sendResponse({ error: error.message });
  }
  // Return true to indicate async response
  return true;
});

// Process image using canvas
const processImage = async ({ imageData, type, options }) => {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL(type || 'image/png', options?.quality || 1));
    };
    image.src = imageData;
  });
};

// Handle special page processing
const handleProcessSpecialPage = async ({ dataUrl }) => {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      globalCanvas = createCanvas(image.width, image.height);
      const context = globalCanvas.getContext('2d');
      context.drawImage(image, 0, 0);
      // Notify service worker that image is processed
      chrome.runtime.sendMessage({
        target: 'background',
        action: 'imageProcessed'
      });
      resolve();
    };
    image.src = dataUrl;
  });
};

// Handle capture portion functionality
const handleCapturePortion = async ({ dataUrl, x, y, width, height, visibleWidth, visibleHeight, docWidth, docHeight }) => {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const curHeight = image.width < docWidth ? image.height - 17 : image.height; // scrollBarY
      const curWidth = image.height < docHeight ? image.width - 17 : image.width; // scrollBarX
      const zoomX = curWidth / visibleWidth;
      const zoomY = curHeight / visibleHeight;
      globalCanvas = createCanvas(width * zoomX, height * zoomY);
      const context = globalCanvas.getContext('2d');
      context.drawImage(image, x * zoomX, y * zoomY, width * zoomX, height * zoomY, 0, 0, width * zoomX, height * zoomY);
      // Notify service worker that image is processed
      chrome.runtime.sendMessage({
        target: 'background',
        action: 'imageProcessed'
      });
      resolve();
    };
    image.src = dataUrl;
  });
};

// Handle capture visible functionality
const handleCaptureVisible = async ({ dataUrl, docWidth, docHeight }) => {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.height < docHeight ? image.width - 17 : image.width;
      const height = image.width < docWidth ? image.height - 17 : image.height;
      globalCanvas = createCanvas(width, height);
      const context = globalCanvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height, 0, 0, width, height);
      // Notify service worker that image is processed
      chrome.runtime.sendMessage({
        target: 'background',
        action: 'imageProcessed'
      });
      resolve();
    };
    image.src = dataUrl;
  });
};

// Handle capture and scroll functionality
const handleCaptureAndScroll = async ({ dataUrl, scrollData }) => {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      if (!globalCanvas) {
        globalCanvas = createCanvas(scrollData.canvasWidth, scrollData.canvasHeight);
      }
      const context = globalCanvas.getContext('2d');
      let width = 0;
      let height = 0;
      // Get scroll bar's width
      const scrollBarY = scrollData.visibleHeight < scrollData.docHeight ? 17 : 0;
      const scrollBarX = scrollData.visibleWidth < scrollData.docWidth ? 17 : 0;
      // Get visible width and height of capture result
      const visibleWidth = (image.width - scrollBarY < globalCanvas.width ? image.width - scrollBarY : globalCanvas.width);
      const visibleHeight = (image.height - scrollBarX < globalCanvas.height ? image.height - scrollBarX : globalCanvas.height);
      // Get region capture start coordinates
      const zoom = scrollData.zoom;
      let x1 = scrollData.startX - Math.round(scrollData.scrollX * zoom);
      let x2 = 0;
      let y1 = scrollData.startY - Math.round(scrollData.scrollY * zoom);
      let y2 = 0;
      if ((scrollData.scrollYCount + 1) * visibleWidth > globalCanvas.width) {
        width = globalCanvas.width % visibleWidth;
        x1 = (scrollData.scrollYCount + 1) * visibleWidth - globalCanvas.width + scrollData.startX - scrollData.scrollX;
      } else {
        width = visibleWidth;
      }
      if ((scrollData.scrollXCount + 1) * visibleHeight > globalCanvas.height) {
        height = globalCanvas.height % visibleHeight;
        if ((scrollData.scrollXCount + 1) * visibleHeight + scrollData.scrollY < scrollData.docHeight) {
          y1 = 0;
        } else {
          y1 = (scrollData.scrollXCount + 1) * visibleHeight + scrollData.scrollY - scrollData.docHeight;
        }
      } else {
        height = visibleHeight;
      }
      x2 = scrollData.scrollYCount * visibleWidth;
      y2 = scrollData.scrollXCount * visibleHeight;
      context.drawImage(image, x1, y1, width, height, x2, y2, width, height);
      // Notify service worker to continue scrolling
      chrome.runtime.sendMessage({
        target: 'background',
        action: 'scrollNext',
        data: {
          visibleWidth,
          visibleHeight
        }
      });
      resolve();
    };
    image.src = dataUrl;
  });
};

// Handle capture and scroll done
const handleCaptureAndScrollDone = async (data) => {
  // Notify service worker that image is processed
  chrome.runtime.sendMessage({
    target: 'background',
    action: 'imageProcessed'
  });
};

// Original capturePortion function for backward compatibility
const capturePortion = async ({ imageData, x, y, width, height, zoomX, zoomY }) => {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = createCanvas(width * zoomX, height * zoomY);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        x * zoomX,
        y * zoomY,
        width * zoomX,
        height * zoomY,
        0,
        0,
        width * zoomX,
        height * zoomY
      );
      resolve(canvas.toDataURL('image/png'));
    };
    image.src = imageData;
  });
};

// Stitch multiple screenshots into a single full-page image
const stitchImages = async ({ images, canvasWidth, canvasHeight }) => {
  return new Promise((resolve) => {
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    let loadedCount = 0;
    const imgElements = [];
    // Preload all images
    images.forEach((img, idx) => {
      const image = new window.Image();
      image.onload = () => {
        imgElements[idx] = image;
        loadedCount++;
        if (loadedCount === images.length) {
          // All images loaded, draw them
          images.forEach((img, i) => {
            ctx.drawImage(
              imgElements[i],
              0, 0, img.width, img.height, // source
              img.x, img.y, img.width, img.height // destination
            );
          });
          resolve(canvas.toDataURL('image/png'));
        }
      };
      image.src = img.imageData;
    });
  });
};

// Get canvas data URL for use by contrast-analyzer
const getCanvasDataURL = () => {
  if (globalCanvas) {
    return globalCanvas.toDataURL('image/png');
  }
  return null;
};

// Get canvas for use by contrast-analyzer
const getCanvas = () => globalCanvas;

// Export functions for use by contrast-analyzer if needed
window.getCanvasDataURL = getCanvasDataURL;
window.getCanvas = getCanvas;
