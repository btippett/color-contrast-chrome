/*

 Read license.txt for licensing information.

 */

// Global variables - will be set when canvas is ready
var w, h, image;

// Initialize image analysis after canvas is ready
function initImageAnalysis() {
    w = document.getElementById('canvas').getAttribute('width'); // width of the image
    h = document.getElementById('canvas').getAttribute('height'); // height of the image

    // Check if canvas is properly initialized
    if (!w || !h || w === '0' || h === '0') {
        console.log('Canvas not ready, retrying in 100ms...');
        setTimeout(initImageAnalysis, 100);
        return;
    }

    console.log('Image analysis initialized with canvas dimensions:', w, 'x', h);
    w = parseInt(w);
    h = parseInt(h);
    image = new Array(w * h); // a container to receive the resulting image

    // Now that we have dimensions, set up the rest of the analysis
    setupImageAnalysis();
}

function setupImageAnalysis() {
    var ctx = document.getElementById('canvas').getContext('2d');
    var imgd = ctx.getImageData(0, 0, w, h);
    var pix = new ArrayBuffer(w * h);
    var pixView = new Uint8Array(imgd.data);

    var myVars = new Array();
    myVars[0] = "contrastLevel";
    myVars[1] = "pixelRadius";

    // get the contrast level
    chrome.storage.sync.get(myVars, function(obj) {
        var level = 4.5;
        var radius = 2;
        if (obj['contrastLevel'] == 'WCAG-aa-small') {
            level = 4.5;
        } else if (obj['contrastLevel'] == 'WCAG-aa-large') {
            level = 3.0;
        } else if (obj['contrastLevel'] == 'WCAG-aaa-small') {
            level = 7.0;
        } else if (obj['contrastLevel'] == 'WCAG-aaa-large') {
            level = 4.5;
        }

        if (obj['pixelRadius'] == 'pixelRadius-1') {
            radius = 1;
        } else if (obj['pixelRadius'] == 'pixelRadius-2') {
            radius = 2;
        } else if (obj['pixelRadius'] == 'pixelRadius-3') {
            radius = 3;
        }
        startAnalysis(level, radius);
    });

    function startAnalysis(level, radius) {
        // send the image and parameters to the thread
        myWorker.postMessage({
            "width": w,
            "height": h,
            "iterations": radius,
            "contrastLevel": level,
            "img": pixView.buffer
        }, [pixView.buffer]);
    }
}

function draw() {
    console.log('Drawing contrast mask...');
    const startTime = performance.now();

    // Remove existing mask if it exists
    var existingMask = document.getElementById('contrastMask');
    if (existingMask) {
        existingMask.remove();
    }

    // create a canvas element to draw the resulting image on
    var canv = document.createElement('canvas');
    canv.id = 'contrastMask';
    canv.width = w;
    canv.height = h;
    canv.style.display = 'block';
    canv.style.position = 'absolute';
    canv.style.top = '0px';
    canv.style.left = '0px';
    canv.style.zIndex = '10';

    document.getElementById('photo').appendChild(canv);

    var myContext = canv.getContext('2d', { willReadFrequently: true });

    // Get the original image data
    var cv = document.getElementById('canvas');
    var cvContext = cv.getContext("2d", { willReadFrequently: true });
    var cvImage = cvContext.getImageData(0, 0, w, h);
    var cvData = cvImage.data;

    // Create the mask image data
    var maskImageData = myContext.createImageData(w, h);
    var maskData = maskImageData.data;

    // Optimized pixel processing - process in chunks to avoid blocking
    var totalPixels = w * h;
    var chunkSize = 10000; // Process 10k pixels at a time
    var currentPixel = 0;

    function processChunk() {
        var endPixel = Math.min(currentPixel + chunkSize, totalPixels);

        for (var i = currentPixel; i < endPixel; i++) {
            var pixelData = image[i];
            var pixelLocation = i * 4;

            // Blend mask (75%) with original image (25%)
            maskData[pixelLocation + 0] = pixelData * 0.75 + cvData[pixelLocation + 0] * 0.25;
            maskData[pixelLocation + 1] = pixelData * 0.75 + cvData[pixelLocation + 1] * 0.25;
            maskData[pixelLocation + 2] = pixelData * 0.75 + cvData[pixelLocation + 2] * 0.25;
            maskData[pixelLocation + 3] = 255;
        }

        currentPixel = endPixel;

        if (currentPixel < totalPixels) {
            // Process next chunk on next frame
            requestAnimationFrame(processChunk);
        } else {
            // All pixels processed, draw the final image
            myContext.putImageData(maskImageData, 0, 0);
            finalizeMask();
        }
    }

    function finalizeMask() {
        var bb = dataURItoBlob(canv.toDataURL("image/png"));

        var a = document.getElementById('downloadButton');
        a.download = 'contrast-'+$('levelEvaluated-options').value.toLowerCase() + '.png';
        a.href = window.URL.createObjectURL(bb);

        const endTime = performance.now();
        console.log('Contrast mask drawn and displayed in', (endTime - startTime).toFixed(2), 'ms');

        // Force display and refresh
        document.getElementById('photo').style.display = 'block';

        // Dispatch a custom event to notify that the mask is ready
        const event = new CustomEvent('contrastMaskReady', {
            detail: { canvas: canv }
        });
        document.dispatchEvent(event);
    }

    // Start processing
    processChunk();
}


function dataURItoBlob(dataURI, callback) {
    // adapted from http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata/5100158
    //
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    var bb = new Blob([ab]);
    return bb;
}
;

// launch the analysis as a separate thread
var myWorker = new Worker("background-image-analysis.js");

myWorker.onmessage = function(oEvent) {

    if (oEvent.data.status !== undefined) {
        // update the status of the process
        if (oEvent.data.status == 'done') {
            document.getElementById('percentComplete').innerHTML = "Rendering mask...";
        } else {
            document.getElementById('percentComplete').innerHTML = oEvent.data.status + '%';
        }
    }

    if (oEvent.data.data !== undefined) {
        // receive the resulting image
        image = new Uint8Array(oEvent.data.data);

        draw();

        myWorker.terminate();
        document.getElementById('percentComplete').innerHTML = 'Complete';
        enableMaskButton(true);
        enableDownloadButton(true);
    }

    try {
        obj = JSON.parse(oEvent.data);
        if (obj.status !== undefined) {
            document.getElementById('percentComplete').innerHTML = obj.status + '%';

        }
    } catch (e) {
    }

};

var ctx = document.getElementById('canvas').getContext('2d');
var imgd = ctx.getImageData(0, 0, w, h);
var pix = new ArrayBuffer(w * h);
var pixView = new Uint8Array(imgd.data);

var myVars = new Array();
myVars[0] = "contrastLevel";
myVars[1] = "pixelRadius";

// get the contrast level
chrome.storage.sync.get(myVars, function(obj) {
    var level = 4.5;
    var radius = 2;
    if (obj['contrastLevel'] == 'WCAG-aa-small') {
        level = 4.5;
    } else if (obj['contrastLevel'] == 'WCAG-aa-large') {
        level = 3.0;
    } else if (obj['contrastLevel'] == 'WCAG-aaa-small') {
        level = 7.0;
    } else if (obj['contrastLevel'] == 'WCAG-aaa-large') {
        level = 4.5;
    } else {
        level = 4.5;
    }

    // get the pixel radius
    radius = obj['pixelRadius'];
    if (radius < 1 || radius > 3 || typeof radius == 'undefined') {
        radius = 2;
    } else {
        radius = obj['pixelRadius'];
    }
    startAnalysis(level, radius);
});

function startAnalysis(level, radius) {
    // send the image and parameters to the thread
    myWorker.postMessage({
        "width": w,
        "height": h,
        "iterations": radius,
        "contrastLevel": level,
        "img": pixView.buffer
    }, [pixView.buffer]);
}
