/*

 Read license.txt for licensing information.

 */

// Global variables - will be set when canvas is ready
let w, h, image;

// Initialize image analysis after canvas is ready
function initImageAnalysis() {
    w = document.getElementById('canvas').getAttribute('width');
    h = document.getElementById('canvas').getAttribute('height');

    if (!w || !h || w === '0' || h === '0') {
        console.log('Canvas not ready, retrying in 100ms...');
        setTimeout(initImageAnalysis, 100);
        return;
    }

    console.log(`Image analysis initialized with canvas dimensions: ${w} x ${h}`);
    w = parseInt(w);
    h = parseInt(h);
    image = new Array(w * h);
    setupImageAnalysis();
}

function setupImageAnalysis() {
    const ctx = document.getElementById('canvas').getContext('2d');
    const imgd = ctx.getImageData(0, 0, w, h);
    const pix = new ArrayBuffer(w * h);
    const pixView = new Uint8Array(imgd.data);

    const myVars = ["contrastLevel", "pixelRadius"];

    chrome.storage.sync.get(myVars, (obj) => {
        let level = 4.5;
        let radius = 2;
        switch (obj['contrastLevel']) {
            case 'WCAG-aa-small':
                level = 4.5;
                break;
            case 'WCAG-aa-large':
                level = 3.0;
                break;
            case 'WCAG-aaa-small':
                level = 7.0;
                break;
            case 'WCAG-aaa-large':
                level = 4.5;
                break;
        }

        switch (obj['pixelRadius']) {
            case 'pixelRadius-1':
                radius = 1;
                break;
            case 'pixelRadius-2':
                radius = 2;
                break;
            case 'pixelRadius-3':
                radius = 3;
                break;
        }
        startAnalysis(level, radius);
    });

    const startAnalysis = (level, radius) => {
        myWorker.postMessage({
            width: w,
            height: h,
            iterations: radius,
            contrastLevel: level,
            img: pixView.buffer
        }, [pixView.buffer]);
    };
}

function draw() {
    console.log('Drawing contrast mask...');
    const startTime = performance.now();

    const existingMask = document.getElementById('contrastMask');
    if (existingMask) {
        existingMask.remove();
    }

    const canv = document.createElement('canvas');
    canv.id = 'contrastMask';
    canv.width = w;
    canv.height = h;
    canv.style.display = 'block';
    canv.style.position = 'absolute';
    canv.style.top = '0px';
    canv.style.left = '0px';
    canv.style.zIndex = '10';

    document.getElementById('photo').appendChild(canv);

    const myContext = canv.getContext('2d', { willReadFrequently: true });

    const cv = document.getElementById('canvas');
    const cvContext = cv.getContext('2d', { willReadFrequently: true });
    const cvImage = cvContext.getImageData(0, 0, w, h);
    const cvData = cvImage.data;

    const maskImageData = myContext.createImageData(w, h);
    const maskData = maskImageData.data;

    const totalPixels = w * h;
    const chunkSize = 10000;
    let currentPixel = 0;

    const processChunk = () => {
        const endPixel = Math.min(currentPixel + chunkSize, totalPixels);

        for (let i = currentPixel; i < endPixel; i++) {
            const pixelData = image[i];
            const pixelLocation = i * 4;

            maskData[pixelLocation + 0] = pixelData * 0.75 + cvData[pixelLocation + 0] * 0.25;
            maskData[pixelLocation + 1] = pixelData * 0.75 + cvData[pixelLocation + 1] * 0.25;
            maskData[pixelLocation + 2] = pixelData * 0.75 + cvData[pixelLocation + 2] * 0.25;
            maskData[pixelLocation + 3] = 255;
        }

        currentPixel = endPixel;

        if (currentPixel < totalPixels) {
            requestAnimationFrame(processChunk);
        } else {
            myContext.putImageData(maskImageData, 0, 0);
            finalizeMask();
        }
    };

    const finalizeMask = () => {
        const bb = dataURItoBlob(canv.toDataURL('image/png'));

        const a = document.getElementById('downloadButton');
        a.download = `contrast-${$('levelEvaluated-options').value.toLowerCase()}.png`;
        a.href = window.URL.createObjectURL(bb);

        const endTime = performance.now();
        console.log(`Contrast mask drawn and displayed in ${(endTime - startTime).toFixed(2)} ms`);

        document.getElementById('photo').style.display = 'block';

        const event = new CustomEvent('contrastMaskReady', {
            detail: { canvas: canv }
        });
        document.dispatchEvent(event);
    };

    processChunk();
}


function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}
;

// launch the analysis as a separate thread
const myWorker = new Worker('background-image-analysis.js');

myWorker.onmessage = (oEvent) => {
    if (oEvent.data.status !== undefined) {
        if (oEvent.data.status === 'done') {
            document.getElementById('percentComplete').innerHTML = 'Rendering mask...';
        } else {
            document.getElementById('percentComplete').innerHTML = `${oEvent.data.status}%`;
        }
    }

    if (oEvent.data.data !== undefined) {
        image = new Uint8Array(oEvent.data.data);
        draw();
        myWorker.terminate();
        document.getElementById('percentComplete').innerHTML = 'Complete';
        enableMaskButton(true);
        enableDownloadButton(true);
    }

    try {
        const obj = JSON.parse(oEvent.data);
        if (obj.status !== undefined) {
            document.getElementById('percentComplete').innerHTML = `${obj.status}%`;
        }
    } catch (e) {}
};
