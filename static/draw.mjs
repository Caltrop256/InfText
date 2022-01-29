const exp = {
    claimed: new Set(),
    needsRedraw: false
};

let firstDraw = true;

import Chunk from './chunk.mjs'
import Camera from './camera.mjs'
import Caret from './caret.mjs'
import HUD from './hud.mjs'
import Socket from './socket.mjs'

document.body.style.overflow = 'hidden';
document.body.style.cursor = 'text';
document.body.style.backgroundColor = Chunk.colors[Chunk.defaultBackground];
document.documentElement.style.backgroundColor = Chunk.colors[Chunk.defaultBackground];

const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0px';
canvas.style.left = '0px';
const ctx = canvas.getContext('2d');

const foreignCarets = new Map();
const cache = new Map();
const spaces = ' '.repeat(7);
const loading = new Uint32Array(Chunk.rowSize * Chunk.colSize);
loading.set(
    (
        spaces + ' ____ ____ ____ ____ ____ ____ ____ ' + spaces +
        spaces + '||L |||O |||A |||D |||I |||N |||G ||' + spaces +
        spaces + '||__|||__|||__|||__|||__|||__|||__||' + spaces +
        spaces + '|/__\\|/__\\|/__\\|/__\\|/__\\|/__\\|/__\\|' + spaces
    ).repeat(6)
    .split('').map(c => Chunk.charToCode(c, 8, 0))
)
if(Socket.historicalMode) loading.fill(Chunk.blank);
let placeHolderChunk = null;

const diff = (s0, s1) => {
    const values = [];
    for(const v of s0) {
        if(!s1.has(v)) values.push(v)
    }
    return values;
}

exp.updateClaimedChunks = () => {
    exp.needsRedraw = true;
    const newClaim = new Set();
    const cw = Chunk.rowSize * Chunk.unitWidth;
    const ch = Chunk.colSize * Chunk.unitHeight;

    console.log(Camera.x, Camera.y);

    const cax = Math.floor(Camera.x / cw) - 1;
    const cay = Math.floor(Camera.y / ch) - 1;
    if(Math.abs(cax) >= Number.MAX_SAFE_INTEGER || Math.abs(cay) >= Number.MAX_SAFE_INTEGER) {
        console.warn('out of range!');
        return;
    }
    const cvpx = Math.ceil(window.innerWidth / cw) + cax + 2;
    const cvpy = Math.ceil(window.innerHeight / ch) + cay + 2;

    for(let y = cay; y < cvpy; ++y) {
        for(let x = cax; x < cvpx; ++x) {
            newClaim.add(x + ',' + y);
            if(newClaim.size >= 250) break;
        }
    }

    const added = diff(newClaim, exp.claimed);
    const removed = diff(exp.claimed, newClaim);
    const removedSet = new Set(removed);

    if(!added.length && !removed.length) return;

    for(const [caretId, caret] of foreignCarets) {
        const id = Math.floor(caret.col / Chunk.rowSize) + ',' + Math.floor(caret.ln / Chunk.colSize);
        if(removedSet.has(id)) foreignCarets.delete(caretId);
    }

    exp.claimed = newClaim;
    if(Socket.historicalMode) return;
    for(const k of cache) {
        if(!exp.claimed.has(k)) cache.delete(k);
    }

    Socket.postMessage(JSON.stringify({added, removed}));
}

const resize = () => {
    canvas.width = Math.floor(window.innerWidth / Chunk.unitWidth) * Chunk.unitWidth;
    canvas.height = Math.floor(window.innerHeight / Chunk.unitHeight) * Chunk.unitHeight;
    canvas.style.left = ((window.innerWidth - canvas.width) / 2) + 'px';
    canvas.style.top = ((window.innerHeight - canvas.height) / 2) + 'px';
    HUD.top = 4 * Chunk.unitHeight;
    exp.updateClaimedChunks();
    placeHolderChunk = Chunk.draw(Chunk.fromUint32Array(loading));
}
resize();
window.addEventListener('resize', resize);

document.body.appendChild(canvas);

const drawChunk = (x, y, id) => {
    if(cache.has(id)) {
        const c = cache.get(id);
        const data = c.imageData || (c.imageData = Chunk.draw(c));
        ctx.putImageData(data, x, y);
        return true;
    } else {
        ctx.putImageData(placeHolderChunk, x, y);
        return false;
    }
}

const defaultClickableLength = HUD.clickables.length;

const drawCaret = (col, ln, erase = false) => {
    const posX = Math.floor(col * Chunk.unitWidth - Camera.x);
    if(posX < -Chunk.unitWidth || posX >= canvas.width + Chunk.unitWidth || Math.abs(posX) >= 2147483647) return;
    const posY = Math.floor(ln * Chunk.unitHeight - Camera.y);
    if(posY < -Chunk.unitHeight || posY >= canvas.height + Chunk.unitHeight || Math.abs(posY) >= 2147483647) return;

    const c = cache.get(Math.floor(col / Chunk.rowSize) + ',' + Math.floor(ln / Chunk.colSize));
    if(!c) return;
    let localCol = col % Chunk.rowSize;
    let localLn = ln % Chunk.colSize;
    if(localCol < 0) localCol += Chunk.rowSize;
    if(localLn < 0) localLn += Chunk.colSize;

    const code = c.lines[localLn][localCol] || Chunk.charToCode(' ', Chunk.defaultForeground, Chunk.defaultBackground);
    if(erase) {
        Chunk.letter.draw(ctx, code, posX, posY);
        for(let i = defaultClickableLength; i < HUD.clickables.length; ++i) {
            if(!HUD.clickables[i].fixed && HUD.clickables[i].sln == ln && HUD.clickables[i].scol <= col && col <= HUD.clickables[i].ecol) {
                ctx.fillStyle = Chunk.colors[code >> 16 & 0xf];
                ctx.fillRect(posX, posY + Chunk.unitHeight - 1, Chunk.unitWidth, 1);
                break;
            };
        }
    } else {
        if((code >> 16 & 0xf) != (code >> 20)) Chunk.letter.draw(ctx, (code & 0xffff) | ((code >> 16 & 0xf) << 20) | ((code >> 20) << 16), posX, posY);
        else {
            const im = new ImageData(Chunk.unitWidth, Chunk.unitHeight);
            im.data.set(Chunk.letter.getImageData(code).data);
            for(let i = 0; i < im.data.length; i += 4) {
                im.data[i + 0] = 0xff - im.data[i + 0];
                im.data[i + 1] = 0xff - im.data[i + 1];
                im.data[i + 2] = 0xff - im.data[i + 2];
            }
            ctx.putImageData(im, posX, posY);
        }            
    }
}

const draw = () => {
    ctx.fillStyle = Chunk.colors[Chunk.defaultBackground];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cw = Chunk.rowSize * Chunk.unitWidth;
    const ch = Chunk.colSize * Chunk.unitHeight;

    let encounteredUnloaded = false;

    for(const k of exp.claimed) {
        const [x, y] = k.split(',');
        if(!drawChunk(Math.round(x * cw - Camera.x), Math.round(y * ch - Camera.y), k)) encounteredUnloaded = true;
    }

    if(firstDraw && (!encounteredUnloaded || Socket.historicalMode)) {
        firstDraw = false;
        document.getElementsByClassName('terminal')[0].remove();
        window.onerror = null;
    }
}

const processVisibleText = () => {
    HUD.clickables.length = defaultClickableLength;
    const cw = Chunk.rowSize * Chunk.unitWidth;
    const ch = Chunk.colSize * Chunk.unitHeight;

    for(const id of exp.claimed) {
        if(!cache.has(id)) continue;
        const chunkData = cache.get(id);
        const [cx, cy] = id.split(',').map(Number);
        for(let sty = 0; sty < Chunk.colSize; ++sty) {
            for(let stx = 0; stx < Chunk.rowSize; ++stx) {
                if(String.fromCharCode(chunkData.lines[sty][stx] & 0xffff) == '@') {
                    const colors = [chunkData.lines[sty][stx] >> 16 & 0xf];
                    let valid = false;
                    let data = chunkData;
                    let lcx = cx;
                    let encounteredComa = false;
                    let encounteredSpace = false;

                    let x = '';
                    let y = '';

                    let tx = stx;
                    while(true) {
                        tx += 1;
                        if(tx == Chunk.rowSize) {
                            tx = 0;
                            data = cache.get((lcx += 1) + ',' + cy);
                            if(!data) break;
                        }
                        const char = String.fromCharCode(data.lines[sty][tx] & 0xffff);
                        colors.push(data.lines[sty][tx] >> 16 & 0xf);
                        if(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(char)) {
                            if(encounteredComa) y += char;
                            else x += char;
                        }
                        else if((!x && char == '-') || (encounteredComa && !y && char == '-')) {
                            if(encounteredComa) y += char;
                            else x += char;
                        }
                        else if(!encounteredComa && char == ',') encounteredComa = true;
                        else if(encounteredComa && !y && !encounteredSpace && /\s/.test(char)) {
                            encounteredSpace = true;
                        }
                        else {
                            if(x && y && x != '-' && y != '-') valid = true;
                            break;
                        }
                    }
                    if(!valid) continue;
                    const len = x.length + y.length + 2 + encounteredSpace;
                    if(len >= Chunk.rowSize * 3) continue;
                    if(Math.abs(x) >= Number.MAX_SAFE_INTEGER || Math.abs(y) >= Number.MAX_SAFE_INTEGER) continue;

                    for(let i = 0; i < len; ++i) {
                        ctx.fillStyle = Chunk.colors[colors[i]];
                        const uy = (cy * ch + sty * Chunk.unitHeight) - Camera.y + Chunk.unitHeight - 1;
                        if(uy >= HUD.top - Chunk.unitHeight * 0.4) ctx.fillRect(
                            (cx * cw + (stx + i) * Chunk.unitWidth) - Camera.x,
                            uy,
                            Chunk.unitWidth,
                            1
                        )
                    } 
                    HUD.clickables.push({
                        sln: cy * Chunk.colSize + sty,
                        scol: cx * Chunk.rowSize + stx,
                        eln: cy * Chunk.colSize + sty,
                        ecol: cx * Chunk.rowSize + stx + len - 1,
                        callback() {
                            Camera.teleportTo(x, y, true);
                        }
                    });
                }
            }
        }
    }
}

exp.draw = draw;
exp.cache = cache;
exp.resize = resize;
exp.canvas = canvas;
exp.drawChunk = drawChunk;
exp.foreignCarets = foreignCarets;
exp.drawCaret = drawCaret;
exp.processVisibleText = processVisibleText;
exp.caretInfiniteBlink = true;
export default exp;

const prevCaret = {
    ln: null,
    col: null
}
void function loop() {
    requestAnimationFrame(loop);
    if(exp.needsRedraw) {
        exp.needsRedraw = false;
        draw();
        processVisibleText();
    }

    if(HUD.drawForeignCarets) {
        for(const [, caret] of foreignCarets) {
            caret.erase = (caret.blinkInd % 72) > 36 && (exp.caretInfiniteBlink || caret.blinkInd < 72 * 15);
            if(caret.prevLn != caret.ln || caret.prevCol != caret.col || caret.erase != (((caret.blinkInd - 1) % 72) > 36 && (caret.blinkInd - 1) < 72 * 15)) {
                drawCaret(caret.prevCol, caret.prevLn, true);
                caret.prevLn = caret.ln;
                caret.prevCol = caret.col;
            }
        }
    
        for(const [, caret] of foreignCarets) {
            caret.blinkInd += 1;
            if(!caret.erase) drawCaret(caret.col, caret.ln, false);
        }
    }

    const erase = (Caret.blinkInd % 72) > 36 && (exp.caretInfiniteBlink || Caret.blinkInd < 72 * 15);
    Caret.blinkInd += 1;
    if(prevCaret.col != Caret.col || prevCaret.ln != Caret.ln) {
        drawCaret(prevCaret.col, prevCaret.ln, true);
        prevCaret.col = Caret.col;
        prevCaret.ln = Caret.ln;
        if(HUD.drawForeignCarets) Socket.postMessage(JSON.stringify({pos: {ln: Caret.ln, col: Caret.col}}));
        if(!erase) drawCaret(Caret.col, Caret.ln, false);
    } else {
        drawCaret(Caret.col, Caret.ln, erase);
    }

    HUD.draw(canvas, ctx);

    if(Math.abs(Camera.velX) >= 0.00000001 || Math.abs(Camera.velY) >= 0.00000001) {
        if(!Camera.isMoving) {
            Camera.velX *= 0.85;
            Camera.velY *= 0.85;
            Camera.x += Camera.velX;
            Camera.y += Camera.velY;
        }
    }
}();