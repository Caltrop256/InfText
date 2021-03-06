import Caret from './caret.mjs'
import Chunk from './chunk.mjs'
import Draw from './draw.mjs'
import HUD from './hud.mjs'

const camera = {
    refuseMovement: true,
    scrollMove: true,
    invertScrollAxis: false,
    scrollSpeedModifier: 0.5,
    scrollSpeedX: 2,
    scrollSpeedY: 1,
    smoothScroll: true,

    _x: Caret.col * Chunk.unitWidth - (window.innerWidth * 0.5),
    _y: Caret.ln * Chunk.unitHeight - (window.innerHeight * 0.5),
    get x() {
        return this._x;
    },
    set x(v) {
        if(camera.refuseMovement) return false;
        Draw.updateClaimedChunks();
        return this._x =  Math.round(v);
    },
    get y() {
        return this._y;
    },
    set y(v) {
        if(camera.refuseMovement) return false;
        Draw.updateClaimedChunks();
        return this._y = Math.round(v);
    },
    isMoving: false,
    velX: 0,
    velY: 0
}

const anchor = {x: -1, y: -1};
const pinchZoom = {
    startDist: 0,
    startPos: {x: 0, y: 0},
    startFontSize: 0,
    scaling: false
}
const getTouchDistance = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);

const down = (x, y) => {
    if(y < HUD.top) return;
    anchor.x = x;
    anchor.y = y;
    camera.isMoving = true;
    document.body.style.cursor = 'move';
}
window.addEventListener('mousedown', e => {
    down(e.clientX, e.clientY);
});
window.addEventListener('touchstart', e => {
    if(e.touches.length == 2) {
        pinchZoom.scaling = true;
        pinchZoom.startDist = getTouchDistance(e);
        pinchZoom.startPos.x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        pinchZoom.startPos.y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        pinchZoom.startFontSize = Chunk.fontSize;
    }
    down(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
})

const up = () => {
    camera.isMoving = false
    document.body.style.cursor = 'text';
}
window.addEventListener('mouseup', up);
window.addEventListener('touchend', up);
window.addEventListener('touchcancel', up);

const move = (x, y, vel = true) => {
    if(camera.isMoving) {
        if(vel) {
            camera.velX = anchor.x - x;
            camera.velY = anchor.y - y;
            camera.x += camera.velX;
            camera.y += camera.velY;
        } else {
            camera.velX = 0;
            camera.velY = 0;
            camera.x += anchor.x - x;
            camera.y += anchor.y - y;
        }
    }
    anchor.x = x;
    anchor.y = y;
}
window.addEventListener('mousemove', e => {
    move(e.clientX, e.clientY, true || e.buttons == 1);
})
const zoomTo = (prevPoint, point, size) => {
    Chunk.changeFontSize(size);
    camera.x -= (((camera.x + prevPoint.x) / Chunk.unitWidth) - point.x) * Chunk.unitWidth;
    camera.y -= (((camera.y + prevPoint.y) / Chunk.unitHeight) - point.y) * Chunk.unitHeight;
    Draw.cache.forEach(c => c.imageData = null);
    Draw.resize();
}
camera.zoomTo = zoomTo;
window.addEventListener('touchmove', e => {
    if(e.touches.length == 1) move(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    else if(e.touches.length) {
        const scale = Math.round(getTouchDistance(e) / pinchZoom.startDist * pinchZoom.startFontSize);
        if(scale <= 4 || scale >= 80) return;
        if(scale == Chunk.fontSize) return;
        zoomTo(pinchZoom.startPos, {
            x: (camera.x + pinchZoom.startPos.x) / Chunk.unitWidth,
            y: (camera.y + pinchZoom.startPos.y) / Chunk.unitHeight
        }, scale);
        pinchZoom.startPos.x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        pinchZoom.startPos.y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
})

window.addEventListener('keydown', e => {
    switch(e.key) {
        case 'Control' :
            camera.scrollMove = false;
            break;
        case 'Shift' :
            camera.invertScrollAxis = true;
            break;
    }
});
window.addEventListener('keyup', e => {
    switch(e.key) {
        case 'Control' :
            camera.scrollMove = true;
            break;
        case 'Shift' :
            camera.invertScrollAxis = false;
            break;
    }
});
window.addEventListener('focusin', e => {
    camera.scrollMove = true;
    camera.invertScrollAxis = false;
});

window.addEventListener('wheel', e => {
    e.preventDefault();
    if(camera.refuseMovement) return;

    const memberVert = camera.invertScrollAxis ? 'x' : 'y';
    const memberHoriz = camera.invertScrollAxis ? 'y' : 'x';

    if(camera.scrollMove) {
        if(camera.smoothScroll) {
            camera['vel' + memberHoriz.toUpperCase()] += e.deltaX * camera.scrollSpeedX * camera.scrollSpeedModifier * 0.25;
            camera['vel' + memberVert.toUpperCase()] += e.deltaY * camera.scrollSpeedY * camera.scrollSpeedModifier * 0.25;
        } else {
            camera[memberHoriz] += Math.min(Math.abs(e.deltaX) * 1, Infinity) * Math.sign(e.deltaX) * camera.scrollSpeedX * camera.scrollSpeedModifier;
            camera[memberVert] += Math.min(Math.abs(e.deltaY) * 1, Infinity) * Math.sign(e.deltaY) * camera.scrollSpeedY * camera.scrollSpeedModifier;
        }
    } else {
        if(e.deltaY >= 0 && Chunk.fontSize <= 4) return;
        if(e.deltaY < 0 && Chunk.fontSize >= 80) return;
    
        zoomTo(anchor, {
            x: (camera.x + anchor.x) / Chunk.unitWidth,
            y: (camera.y + anchor.y) / Chunk.unitHeight
        }, e.deltaY < 0 ? Chunk.fontSize + 4 : Chunk.fontSize - 4);
    }
}, {passive: false})

camera.teleportTo = (x, y, updateState = true) => {
    if(updateState) Caret.updateState(Caret.col, Caret.ln, false);
    camera.x = x * Chunk.unitWidth - (window.innerWidth * 0.5);
    camera.y = y * Chunk.unitHeight - (window.innerHeight * 0.5);
    Caret._acol = (Caret.col = +x);
    Caret._aln = (Caret.ln = +y);
    Draw.updateClaimedChunks();
    Draw.needsRedraw = true;
    if(updateState) Caret.updateState(x, y, false);
}

window.addEventListener('popstate', e => {
    const state = e.state || {x: 0, y: 0};
    camera.teleportTo(state.x || 0, state.y || 0, false);
})

export default camera;