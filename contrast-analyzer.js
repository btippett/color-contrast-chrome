/*

 Read license.txt for licensing information.

 */


class Canvas {
    // ...existing code...
}

function isHighVersion() {
    const version = navigator.userAgent.match(/Chrome\/(\d+)/)[1];
    return version > 9;
}

function $(id) {
    return document.getElementById(id);
}

function addClass(element, className) {
    const classes = element.className.split(' ');
    classes.push(className);
    element.className = classes.join(' ');
}

function removeClass(element, myClass) {
    element.className = element.className.replace(new RegExp(`\\b${myClass}\\b`), '');
}

function i18nReplace(id, messageKey) {
    return $(id).innerHTML = chrome.i18n.getMessage(messageKey);
}

function getCssProperty(elmId, property) {
    const elem = document.getElementById(elmId);
    return window.getComputedStyle(elem, null).getPropertyValue(property);
}

function getStyle(element, property) {
    return window.getComputedStyle(element)[property];
}

function setStyle(element) {
    const argLength = arguments.length;
    const arg1 = arguments[1];
    if (argLength === 2 && arg1.constructor === Object) {
        for (const prop in arg1) {
            const camelCasedProp = prop.replace(/-([a-z])/gi, (n, letter) => letter.toUpperCase());
            element.style[camelCasedProp] = arg1[prop];
        }
    } else if (argLength === 3) {
        element.style[arg1] = arguments[2];
    }
}

i18nReplace('WCAG-aa-small', 'wcag_aa_small_level');
i18nReplace('WCAG-aa-large', 'wcag_aa_large_level');
i18nReplace('WCAG-aaa-small', 'wcag_aaa_small_level');
i18nReplace('WCAG-aaa-large', 'wcag_aaa_large_level');



$('maskButton').addEventListener('click', (e) => {
    if (getStyle($("contrastMask"), "display") === 'block') {
        $('contrastMask').style.cssText = 'display:none;';
        $('maskButton').innerHTML = 'Show Mask';
    } else {
        $('contrastMask').style.cssText = 'display:block;';
        $('maskButton').innerHTML = 'Hide Mask';
    }
});

$('rescanButton').addEventListener('click', () => {
    location.reload();
});

// Remove background page access for MV3 compatibility
// var bg = chrome.extension.getBackgroundPage();

const canvas = new Canvas();

class Photoshop {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.tabTitle = '';
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.dragFlag = false;
        this.flag = 'rectangle';
        this.layerId = 'layer0';
        this.canvasId = '';
        this.color = '#ff0000';
        this.highlightColor = '';
        this.lastValidAction = 0;
        this.markedArea = [];
        this.isDraw = true;
        this.offsetX = 0;
        this.offsetY = 36;
        this.nowHeight = 0;
        this.nowWidth = 0;
        this.highlightType = 'border';
        this.highlightMode = 'rectangle';
        this.text = '';
        this.i18nReplace = i18nReplace;
    }

    initCanvas = () => {
        if (!window.canvasDataBridge || !window.canvasDataBridge.isReady()) {
            setTimeout(() => this.initCanvas(), 100);
            return;
        }
        const sourceCanvas = window.canvasDataBridge.getCanvas();
        $('canvas').width = $('mask-canvas').width = $('photo').style.width = this.canvas.width = sourceCanvas.width;
        $('canvas').height = $('mask-canvas').height = $('photo').style.height = this.canvas.height = sourceCanvas.height;
        const canvasContext = $('canvas').getContext('2d', { willReadFrequently: true });
        const maskCanvasContext = $('mask-canvas').getContext('2d', { willReadFrequently: true });
        const context = this.canvas.getContext('2d');
        context.drawImage(sourceCanvas, 0, 0);
        canvasContext.drawImage(this.canvas, 0, 0);
        $('canvas').style.display = 'block';
        if (typeof initImageAnalysis === 'function') {
            console.log('Initializing image analysis...');
            initImageAnalysis();
        }
    }

    init = () => {
        chrome.runtime.getPlatformInfo(async (info) => {
            const isMac = info.os === 'mac';
            if (isMac) {
                // Mac-specific initialization if needed
            }
            this.initTools();
            document.addEventListener('contrastMaskReady', (event) => {
                console.log('Contrast mask is ready and displayed');
                const maskCanvas = event.detail.canvas;
                if (maskCanvas) {
                    maskCanvas.style.display = 'block';
                    maskCanvas.style.visibility = 'visible';
                }
            });
            this.initCanvas();
        });
        chrome.storage.session.get('tabTitle', (result) => {
            this.tabTitle = result.tabTitle || 'Untitled';
        });
        const showBoxHeight = () => {
            $('showBox').style.height = window.innerHeight - this.offsetY - 1;
        };
        setTimeout(showBoxHeight, 50);
    }

    markCurrentElement = (element) => {
        if (element && element.parentNode) {
            const children = element.parentNode.children;
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node === element) {
                    element.className = 'mark';
                } else {
                    node.className = '';
                }
            }
        }
    }

    openOptionPage = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    }

    closeCurrentTab = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.remove(tabs[0].id);
        });
    }

    finish = () => {
        const context = $('canvas').getContext('2d');
        context.drawImage(this.canvas, 0, 0);
    }

    createDiv = () => {
        this.lastValidAction++;
        this.layerId = `layer${this.lastValidAction}`;
        if ($(this.layerId)) {
            this.removeElement(this.layerId);
        }
        const divElement = document.createElement('div');
        divElement.id = this.layerId;
        divElement.className = 'layer';
        $('photo').appendChild(divElement);
        if (this.flag === 'blur') {
            this.createCanvas(this.layerId);
        }
        return divElement;
    }

    createCanvas = (parentId) => {
        this.canvasId = `cav-${parentId}`;
        if (!$(this.canvasId)) {
            const cav = document.createElement('canvas');
            cav.id = this.canvasId;
            cav.width = 10;
            cav.height = 10;
            $(this.layerId).appendChild(cav);
            return cav;
        }
        return $(this.canvasId);
    }

    removeLayer = (id) => {
        for (let i = 0; i < this.markedArea.length; i++) {
            if (this.markedArea[i].id === id) {
                this.markedArea.splice(i, 1);
                break;
            }
        }
        this.removeElement(id);
    }

    removeElement = (id) => {
        if ($(id)) {
            $(id).parentNode.removeChild($(id));
        }
    }

    save = () => {
        this.draw();
        const formatParam = localStorage.screenshootQuality || 'png';
        let dataUrl;
        if (formatParam === 'jpeg' && isHighVersion()) {
            dataUrl = $('canvas').toDataURL('image/jpeg', 0.5);
        } else {
            dataUrl = $('canvas').toDataURL('image/png');
        }
        const pluginobj = document.getElementById('pluginobj');
        if (!localStorage.lastSavePath) localStorage.lastSavePath = localStorage.savePath;
        pluginobj.SaveScreenshot(
            dataUrl,
            this.tabTitle,
            localStorage.lastSavePath,
            (result, path) => {
                let message = chrome.i18n.getMessage('save_fail');
                let messageClass = 'tip_failed';
                if (result === 0 && path) {
                    const i18nMessage = chrome.i18n.getMessage('saved_to_path');
                    message = `${i18nMessage}<a title="${path}" onclick="bg.plugin.openSavePath('${path.replace(/\\/g, '/')}');">${path}</a>`;
                    messageClass = 'tip_succeed';
                    localStorage.lastSavePath = path;
                }
                if (result !== 2) this.showTip(messageClass, message, 5000);
            },
            chrome.i18n.getMessage("save_image")
        );
        this.finish();
    }

    copy = () => {
        this.draw();
        const formatParam = localStorage.screenshootQuality || 'png';
        let dataUrl;
        if (formatParam === 'jpeg' && isHighVersion()) {
            dataUrl = $('canvas').toDataURL('image/jpeg', 0.5);
        } else {
            dataUrl = $('canvas').toDataURL('image/png');
        }
        const copyFlag = bg.plugin.saveToClipboard(dataUrl);
        let messageKey = 'tip_copy_failed';
        let messageClass = 'tip_failed';
        if (copyFlag) {
            messageKey = 'tip_copy_succeed';
            messageClass = 'tip_succeed';
        }
        const message = chrome.i18n.getMessage(messageKey);
        this.showTip(messageClass, message);
        this.finish();
    }

    printImage = () => {
        this.draw();
        const formatParam = localStorage.screenshootQuality || 'png';
        let dataUrl;
        if (formatParam === 'jpeg' && isHighVersion()) {
            dataUrl = $('canvas').toDataURL('image/jpeg', 0.5);
        } else {
            dataUrl = $('canvas').toDataURL('image/png');
        }
        const width = $('canvas').width;
        const height = $('canvas').height;
        const pluginobj = document.getElementById('pluginobj');
        pluginobj.PrintImage(dataUrl, this.tabTitle, width, height);
        this.finish();
    }

    drawLineOnMaskCanvas = (startX, startY, endX, endY, type, layerId) => {
        let ctx = $('mask-canvas').getContext('2d');
        ctx.clearRect(0, 0, $('mask-canvas').width, $('mask-canvas').height);
        if (type === 'drawEnd') {
            const offset = 20;
            const width = Math.abs(endX - this.startX) > 0 ? Math.abs(endX - this.startX) : 0;
            const height = Math.abs(endY - this.startY) > 0 ? Math.abs(endY - this.startY) : 0;
            const offsetLeft = parseInt($(layerId).style.left);
            const offsetTop = parseInt($(layerId).style.top);
            startX = startX - offsetLeft + offset / 2;
            startY = startY - offsetTop + offset / 2;
            endX = endX - offsetLeft + offset / 2;
            endY = endY - offsetTop + offset / 2;
            $(layerId).style.left = offsetLeft - offset / 2;
            $(layerId).style.top = offsetTop - offset / 2;
            const cavCopy = this.createCanvas(layerId);
            cavCopy.width = width + offset;
            cavCopy.height = height + offset;
            ctx = cavCopy.getContext('2d');
        }
        if (localStorage.lineType === 'line') {
            canvas.drawLine(ctx, localStorage.lineColor, 'round', 2, startX, startY, endX, endY);
        } else {
            canvas.drawArrow(ctx, localStorage.lineColor, 2, 4, 10, 'round', startX, startY, endX, endY);
        }
    }

    createColorPadStr = (element, type) => {
        const colorList = ['#000000', '#0036ff', '#008000', '#dacb23', '#d56400', '#c70000', '#be00b3', '#1e2188', '#0090ff', '#22cc01', '#ffff00', '#ff9600', '#ff0000', '#ff008e', '#7072c3', '#49d2ff', '#9dff3d', '#ffffff', '#ffbb59', '#ff6b6b', '#ff6bbd'];
        const div = document.createElement("div");
        div.id = "colorpad";
        element.appendChild(div);
        for (let i = 0; i < colorList.length; i++) {
            const color = colorList[i];
            const a = document.createElement("a");
            a.id = color;
            a.title = color;
            a.style.backgroundColor = color;
            if (color === '#ffffff') {
                a.style.border = "1px solid #444";
                a.style.width = "12px";
                a.style.height = "12px";
            }
            a.addEventListener('click', (e) => {
                this.colorPadPick(e.target.id, type);
                return false;
            });
            div.appendChild(a);
        }
    }

    setHighlightColorBoxStyle = (color) => {
        const highlightColorBox = $('highlightColorBox');
        highlightColorBox.style.borderColor = color;
        localStorage.highlightType = localStorage.highlightType || 'border';
        if (localStorage.highlightType === 'border') {
            highlightColorBox.style.background = '#ffffff';
            highlightColorBox.style.opacity = 1;
            $('borderMode').className = 'mark';
            $('rectMode').className = '';
        } else if (localStorage.highlightType === 'rect') {
            highlightColorBox.style.background = color;
            highlightColorBox.style.opacity = 0.5;
            $('borderMode').className = '';
            $('rectMode').className = 'mark';
        }
        if (this.flag === 'rectangle') {
            highlightColorBox.style.borderRadius = '0 0';
        } else if (this.flag === 'radiusRectangle') {
            highlightColorBox.style.borderRadius = '3px 3px';
        } else if (this.flag === 'ellipse') {
            highlightColorBox.style.borderRadius = '12px 12px';
        }
        this.markCurrentElement($(this.flag));
    }

    setBlackoutColorBoxStyle = () => {
        localStorage.blackoutType = localStorage.blackoutType || 'redact';
        if (localStorage.blackoutType === 'redact') {
            $('blackoutBox').className = 'rectBox';
            $('redact').className = 'mark';
            $('blur').className = '';
        } else if (localStorage.blackoutType === 'blur') {
            $('blackoutBox').className = 'blurBox';
            $('redact').className = '';
            $('blur').className = 'mark';
        }
    }

    setFontSize = (size) => {
        const id = `size_${size}`;
        localStorage.fontSize = size;
        $('size_10').className = '';
        $('size_16').className = '';
        $('size_18').className = '';
        $('size_32').className = '';
        $(id).className = 'mark';
    }

    setLineColorBoxStyle = () => {
        localStorage.lineType = localStorage.lineType || 'line';
        this.color = localStorage.lineColor = localStorage.lineColor || '#FF0000';
        const ctx = $('lineIconCav').getContext('2d');
        ctx.clearRect(0, 0, 14, 14);
        if (localStorage.lineType === 'line') {
            $('straightLine').className = 'mark';
            $('arrow').className = '';
            canvas.drawLine(ctx, this.color, 'round', 2, 1, 13, 13, 1);
        } else if (localStorage.lineType === 'arrow') {
            $('straightLine').className = '';
            $('arrow').className = 'mark';
            canvas.drawArrow(ctx, this.color, 2, 4, 7, 'round', 1, 13, 13, 1);
        }
    }

    initTools = () => {
        let fontSize = localStorage.fontSize = localStorage.fontSize || 16;
        if (![10, 16, 18, 32].includes(Number(fontSize))) {
            localStorage.fontSize = 16;
        }
        localStorage.highlightMode = this.flag = localStorage.highlightMode || 'rectangle';
        localStorage.highlightColor = localStorage.highlightColor || '#FF0000';
        localStorage.fontColor = localStorage.fontColor || '#FF0000';
        localStorage.highlightType = this.highlightType = localStorage.highlightType || 'border';
        localStorage.blackoutType = localStorage.blackoutType || 'redact';
        localStorage.lineType = localStorage.lineType || 'line';
        localStorage.lineColor = localStorage.lineColor || '#FF0000';
    }

    drawEllipseOnMaskCanvas = (endX, endY, type, layerId) => {
        const ctx = $('mask-canvas').getContext('2d');
        ctx.clearRect(0, 0, $('mask-canvas').width, $('mask-canvas').height);
        let x = (this.startX + endX) / 2;
        let y = (this.startY + endY) / 2;
        let xAxis = Math.abs(endX - this.startX) / 2;
        let yAxis = Math.abs(endY - this.startY) / 2;
        canvas.drawEllipse(ctx, this.color, x, y, xAxis, yAxis, 3, this.highlightType);
        if (type === 'end') {
            const offsetLeft = parseInt($(layerId).style.left);
            const offsetTop = parseInt($(layerId).style.top);
            const startX = this.startX - offsetLeft;
            const startY = this.startY - offsetTop;
            const newEndX = this.endX - offsetLeft;
            const newEndY = this.endY - offsetTop;
            x = (startX + newEndX) / 2;
            y = (startY + newEndY) / 2;
            xAxis = Math.abs(newEndX - startX) / 2;
            yAxis = Math.abs(newEndY - startY) / 2;
            const cavCopy = this.createCanvas(layerId);
            cavCopy.width = Math.abs(endX - this.startX);
            cavCopy.height = Math.abs(endY - this.startY);
            const ctxCopy = cavCopy.getContext('2d');
            canvas.drawEllipse(ctxCopy, this.color, x, y, xAxis, yAxis, 3, this.highlightType);
            ctx.clearRect(0, 0, $('mask-canvas').width, $('mask-canvas').height);
        }
    }

    showTip = (className, message, delay = 2000) => {
        const div = document.createElement('div');
        div.className = className;
        div.innerHTML = message;
        document.body.appendChild(div);
        div.style.left = `${(document.body.clientWidth - div.clientWidth) / 2}px`;
        window.setTimeout(() => {
            document.body.removeChild(div);
        }, delay);
    }
}

const photoshop = new Photoshop();

photoshop.init();
$('photo').addEventListener('mousemove', (e) => photoshop.onMouseMove?.(e), true);
$('photo').addEventListener('mousedown', (e) => photoshop.onMouseDown?.(e), true);
$('photo').addEventListener('mouseup', (e) => photoshop.onMouseUp?.(e), true);
document.addEventListener('mouseup', (e) => photoshop.onMouseUp?.(e), true);
document.addEventListener('mousemove', (e) => photoshop.onMouseMove?.(e), true);

$('canvas').addEventListener('selectstart', (e) => false);
$('mask-canvas').addEventListener('selectstart', (e) => false);

enableMaskButton(false);
enableDownloadButton(false);

chrome.runtime.getPlatformInfo((info) => {
    if (info.os === 'win') {
        addClass($('downloadButton'), 'button-win');
    }
});

// Control more tools list showing and hiding.
(function() {
    const HIDE_MORE_TOOLS_DELAY = 200;
    var timer;
    var moreBtn = $('btnMore');
    var moreToolsList = $('more-tools');
    var printBtn = $('btnPrint');

    // Use chrome.runtime.getPlatformInfo instead of background page
    chrome.runtime.getPlatformInfo(function(info) {
        var isMac = info.os === 'mac';
        var isLinux = info.os === 'linux';

        // Platform-specific initialization code can go here
        // (if any was needed from the original)
    });
})();


const myVars = ["contrastLevel", "pixelRadius"];
chrome.storage.sync.get(myVars, (obj) => {
    if (obj['contrastLevel'] === 'WCAG-aa-small') {
        $('levelEvaluated-options').selectedIndex = 0;
    } else if (obj['contrastLevel'] === 'WCAG-aa-large') {
        $('levelEvaluated-options').selectedIndex = 1;
    } else if (obj['contrastLevel'] === 'WCAG-aaa-small') {
        $('levelEvaluated-options').selectedIndex = 2;
    } else if (obj['contrastLevel'] === 'WCAG-aaa-large') {
        $('levelEvaluated-options').selectedIndex = 3;
    } else {
        $('levelEvaluated-options').selectedIndex = 0;
    }
    const radius = obj['pixelRadius'];
    if (radius < 1 || radius > 3 || typeof radius === 'undefined') {
        $('pixelRadius-options').selectedIndex = 0;
    } else {
        $('pixelRadius-options').selectedIndex = radius - 1;
    }
});

$('levelEvaluated-options').addEventListener('change', () => saveOptions());
$('pixelRadius-options').addEventListener('change', () => saveOptions());

function saveOptions() {
    const e1 = document.getElementById("levelEvaluated-options");
    const WCAGLevel = e1.options[e1.selectedIndex].id;
    chrome.storage.sync.set({ contrastLevel: WCAGLevel });
    const e2 = document.getElementById("pixelRadius-options");
    const pixelValue = e2.options[e2.selectedIndex].text;
    chrome.storage.sync.set({ pixelRadius: pixelValue });
    return true;
    //return HotKeySetting.save();
}

function enableMaskButton(v) {
    if (v) {
        $('maskButton').removeAttribute('disabled');
    } else {
        $('maskButton').setAttribute('disabled', 'true'); // need to explicitly set the value to true otherwise it will fail
    }
}

function enableDownloadButton(v) {
    if (v) {
        removeClass($('downloadButton'), 'inactive');
    } else {
        addClass($('downloadButton'), 'inactive');
    }
}

