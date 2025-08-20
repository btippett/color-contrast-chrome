/*

Read license.txt for licensing information.

*/

// This file is designed to be launched as a web worker thread

let w; // width of the image
let h; // height of the image
let image; // the resulting image, as a set of white or gray pixels on a black background
let imageCheck; // a copy of the results after an iteration, used to check if all calculations are needed in the next iteration
let imageBuffer;

let iterations; // the number of pixels in the radius to search
let pix; // the image passed from the calling function

let totalCalculations = 0; // the total number of calculations needed to complete the analysis
let calculationsCompleted = 0; // the total number of calculations completed so far

let contrastLevel; // the contrast ratio level to check for (passed from the calling function)

const postMessageStep = 250000; // how often to send updates to the calling page, denoted in number of calculations
let nextPostMessage = 0; // the number of calculations to complete before sending the next message to the calling page



function evaluateColorContrast(r1, g1, b1, r2, g2, b2) {
    // Optimized WCAG2 color contrast algorithm
    let r = r1 / 255, g = g1 / 255, b = b1 / 255;
    r = r <= 0.03928 ? r / 12.92 : Math.pow(((r + 0.055) / 1.055), 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow(((g + 0.055) / 1.055), 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow(((b + 0.055) / 1.055), 2.4);
    const l1 = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    r = r2 / 255; g = g2 / 255; b = b2 / 255;
    r = r <= 0.03928 ? r / 12.92 : Math.pow(((r + 0.055) / 1.055), 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow(((g + 0.055) / 1.055), 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow(((b + 0.055) / 1.055), 2.4);
    const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const ratio = l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
    return Math.round(ratio * 10) / 10 >= contrastLevel;
}



function iterativeAnalyze(radius) {
    let x = 0;
    let y = 0;
    const xMax = w;
    const yMax = h;
    let success;
    let foundContrastBorder = false;

    for (let i2 = 0, n2 = imageCheck.length; i2 < n2; i2 += 1) {
        foundContrastBorder = false;
        for (let j2 = 0; j2 <= radius; j2 += 1) {
            if (foundContrastBorder) break;
            for (let k2 = 0; k2 <= radius; k2 += 1) {
                if (foundContrastBorder) break;
                // + + direction
                if (imageCheck[i2 + (w * j2) + (k2)] > 0) foundContrastBorder = true;
                // + - direction
                if (imageCheck[i2 + (w * j2) - (k2)] > 0) foundContrastBorder = true;
                // - + direction
                if (imageCheck[i2 - (w * j2) + (k2)] > 0) foundContrastBorder = true;
                // - - direction
                if (imageCheck[i2 - (w * j2) - (k2)] > 0) foundContrastBorder = true;
            }
        }

        success = 0;

        if (!foundContrastBorder) {
            for (let j = 0; j <= radius; j += 1) {
                for (let k = 0; k <= radius; k += 1) {
                    if (!(j === 0 && k === 0) && (image[y * w + x] === 0 || radius === 1)) {
                        const basePixelRed = pix[i2 * 4];
                        const basePixelGreen = pix[i2 * 4 + 1];
                        const basePixelBlue = pix[i2 * 4 + 2];
                        // + + direction
                        if (evaluateColorContrast(basePixelRed, basePixelGreen, basePixelBlue, pix[i2 * 4 + (w * j * 4) + (k * 4)], pix[i2 * 4 + (w * j * 4) + (k * 4) + 1], pix[i2 * 4 + (w * j * 4) + (k * 4) + 2])) success += 1;
                        // + - direction
                        if (evaluateColorContrast(basePixelRed, basePixelGreen, basePixelBlue, pix[i2 * 4 + (w * j * 4) - (k * 4)], pix[i2 * 4 + (w * j * 4) - (k * 4) + 1], pix[i2 * 4 + (w * j * 4) - (k * 4) + 2])) success += 1;
                        // - + direction
                        if (evaluateColorContrast(basePixelRed, basePixelGreen, basePixelBlue, pix[i2 * 4 - (w * j * 4) + (k * 4)], pix[i2 * 4 - (w * j * 4) + (k * 4) + 1], pix[i2 * 4 - (w * j * 4) + (k * 4) + 2])) success += 1;
                        // - - direction
                        if (evaluateColorContrast(basePixelRed, basePixelGreen, basePixelBlue, pix[i2 * 4 - (w * j * 4) - (k * 4)], pix[i2 * 4 - (w * j * 4) - (k * 4) + 1], pix[i2 * 4 - (w * j * 4) - (k * 4) + 2])) success += 1;
                        if (success > 0) break;
                    }
                }
            }
            // draw the result as a pixel
            if (image[y * w + x] === 0 || radius === 1) {
                if (success > 0) {
                    if (radius === 1) {
                        image[y * w + x] = 255; // white
                    } else if (radius === 2) {
                        image[y * w + x] = 170; // light gray
                    } else if (radius === 3) {
                        image[y * w + x] = 85; // medium gray
                    }
                } else {
                    image[y * w + x] = 0; // black
                }
            }
        }

        updateStatus(radius);
        x += 1;
        if (x >= xMax) {
            x = 0;
            y += 1;
        }
    }
    imageCheck = image.slice(0);
}


function updateStatus(i) {
    calculationsCompleted += (i + 2) * (i + 2);
    if (calculationsCompleted > nextPostMessage) {
        postMessage(`{"status":${Math.round(calculationsCompleted / totalCalculations * 100)}}`);
        nextPostMessage += postMessageStep;
    }
}


function analyze() {
    const d1 = new Date();
    const n1 = d1.getTime();

    for (let i = 1; i <= iterations; i += 1) {
        iterativeAnalyze(i);
    }

    const d2 = new Date();
    const n2 = d2.getTime();
    postMessage({ time: n2 - n1 });

    const buf = new ArrayBuffer(image.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = image.length; i < strLen; i++) {
        bufView[i] = image[i];
    }

    postMessage({ status: 100 });
    postMessage({ status: 'done' });
    postMessage({ status: 100, data: bufView.buffer }, [bufView.buffer]);
}


function grab() {
    analyze();
}


onmessage = (oEvent) => {
    w = oEvent.data.width;
    h = oEvent.data.height;
    contrastLevel = oEvent.data.contrastLevel;
    postMessage({ color: contrastLevel });
    image = new Array(w * h);
    imageCheck = new Array(w * h);
    iterations = oEvent.data.iterations;
    pix = new Uint8Array(oEvent.data.img);
    for (let i = 1; i <= iterations; i += 1) {
        totalCalculations += w * h * (i + 2) * (i + 2);
    }
    grab();
};