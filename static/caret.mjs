import Chunk from './chunk.mjs'
import Draw from './draw.mjs'
import Camera from './camera.mjs'
import HUD from './hud.mjs'
import Socket from './socket.mjs'
import Help from './help.mjs'

const lastPos = {x: 0, y: 0}
const match = location.pathname.match(/^\/@(-?\d+),(-?\d+)/) || [,0, 0];
const [, startX, startY] = match;
const caret = {
    ln: +startY,
    col: +startX,
    _aln: +startY,
    _acol: +startX,

    get aln() {return this._aln},
    get acol() {return this._acol},
    set aln(v) {
        this._aln = v;
        if(Math.abs(lastPos.y - v) >= 30) {
            lastPos.y = v;
            this.updateState(this._acol, this._aln, true);
        }
        return v;
    },
    set acol(v) {
        this._acol = v;
        if(Math.abs(lastPos.x - v) >= 30) {
            lastPos.x = v;
            this.updateState(this._acol, this._aln, true);
        }
        return v;
    },

    blinkInd: 0,

    edits: [],
    editIndex: 0,

    colDir: 1,
    lnDir: 0,

    colorBg: typeof localStorage.getItem('cbg') == 'string' ? localStorage.getItem('cbg') | 0 : Chunk.defaultBackground,
    colorFg: typeof localStorage.getItem('cfg') == 'string' ? localStorage.getItem('cfg') | 0 : Chunk.defaultForeground,

    updateState(x, y, replace = false) {
        try {
            history[replace ? 'replaceState' : 'pushState']({x, y}, '', `/@${x},${y}${Socket.historicalMode ? Socket.historicalMode[0] : ''}`);
        } catch(e) {
            console.warn(e);
        }
    }
}
caret.updateState(startX, startY, true);

const applyDirection = (n = 1) => {
    caret.ln += n * caret.lnDir;
    caret.col += n * caret.colDir;
    caret.blinkInd = 0;
}
caret.applyDirection = applyDirection;

const getCharAt = (col, ln) => {
    const id = Math.floor(col / Chunk.rowSize) + ',' + Math.floor(ln / Chunk.colSize);
    if(!Draw.cache.has(id)) return null;
    const chunk = Draw.cache.get(id);
    let localCol = col % Chunk.rowSize;
    let localLn = ln % Chunk.colSize;
    if(localCol < 0) localCol += Chunk.rowSize;
    if(localLn < 0) localLn += Chunk.colSize;
    return {
        id,
        chunk,
        localCol,
        localLn,
        code: chunk.lines[localLn][localCol] || Chunk.charToCode(' ')
    }
}

const insertChar = (col, ln, code, dontPush = false) => {
    const info = getCharAt(col, ln);
    if(!info) return;
    if(info.code == code) return;
    info.chunk.lines[info.localLn][info.localCol] = code;
    info.chunk.imageData = null;

    Socket.postMessage(JSON.stringify({
        update: [{
            col: info.localCol,
            ln: info.localLn,
            id: info.id,
            code: code
        }]
    }))

    Draw.needsRedraw = true;

    if(dontPush) return;
    if(caret.edits.length != caret.editIndex) caret.edits.length = caret.editIndex;
    caret.edits[caret.editIndex++] = {ln, col, original: info.code, new: code};
}
caret.insertChar = insertChar;

const up = (x, y, type = 0) => {
    if(Camera.refuseMovement) return;
    if(y < HUD.top) return;
    const targetLn = Math.floor((Camera.y + (y - Draw.canvas.offsetTop)) / Chunk.unitHeight);
    const targetCol = Math.floor((Camera.x + (x - Draw.canvas.offsetLeft)) / Chunk.unitWidth);

    switch(type) {
        case 0 :
            caret.ln = targetLn;
            caret.col = targetCol;
            caret.aln = caret.ln;
            caret.acol = caret.col;
            caret.blinkInd = 0;
            fixCamera();
            break;
        case 2 :
            const info = getCharAt(targetCol, targetLn);
            if(info) {
                caret.colorBg = info.code >>> 20;
                caret.colorFg = info.code >> 16 & 0xf;
            }
    }
}
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mouseup', e => {
    up(e.clientX, e.clientY, e.button);
});
window.addEventListener('touchend', e => {
    up(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
});
window.addEventListener('touchcancel', e => {
    up(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
});

const fixCamera = () => {
    if(caret.col - 2 < Math.floor(Camera.x / Chunk.unitWidth)) {
        Camera.x = (caret.col - 2) * Chunk.unitWidth;
        Draw.updateClaimedChunks();
        Draw.needsRedraw = true;
    } else if(caret.col + 2 >= Math.floor((Camera.x + Draw.canvas.width) / Chunk.unitWidth)) {
        Camera.x = (caret.col + 3) * Chunk.unitWidth - Draw.canvas.width;
        Draw.updateClaimedChunks();
        Draw.needsRedraw = true;
    }
    if(caret.ln - 0.5 < Math.floor((Camera.y + HUD.top) / Chunk.unitHeight)) {
        Camera.y = (caret.ln - 0.5) * Chunk.unitHeight - HUD.top;
        Draw.updateClaimedChunks();
        Draw.needsRedraw = true;
    } else if(caret.ln + 2 >= Math.floor((Camera.y + Draw.canvas.height) / Chunk.unitHeight)) {
        Camera.y = (caret.ln + 2.5) * Chunk.unitHeight - Draw.canvas.height;
        Draw.updateClaimedChunks();
        Draw.needsRedraw = true;
    }
}

window.addEventListener('paste', e => {
    if(Camera.refuseMovement) return;
    if(!e.isTrusted) return;
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    if(!paste) return;
    let fg = caret.colorFg;
    let bg = caret.colorBg;
    if(paste.length == 6 && paste.substring(1, 4) == 'inf') {
        caret.colorFg = (fg = (paste.charCodeAt(4) - 1) % 16);
        caret.colorBg = (bg = (paste.charCodeAt(5) - 1) % 16);
    }
    insertChar(caret.col, caret.ln, Chunk.charToCode(paste.charAt(0), fg, bg));
    applyDirection();
    fixCamera();
});

window.addEventListener('copy', e => {
    if(Camera.refuseMovement) return;
    if(!e.isTrusted) return;
    const info = getCharAt(caret.col, caret.ln);
    if(!info) return;
    const data = String.fromCharCode(info.code & 0xffff);// `${)}inf${String.fromCharCode((info.code >> 16 & 0xf) + 1)}${String.fromCharCode((info.code >> 20) + 1)}`;
    (e.clipboardData || window.clipboardData).setData('text/plain', data);
    e.preventDefault();
    fixCamera();
});

window.addEventListener('cut', e => {
    if(Camera.refuseMovement) return;
    if(!e.isTrusted) return;
    const info = getCharAt(caret.col, caret.ln);
    if(!info) return;
    const data = String.fromCharCode(info.code & 0xffff);
    (e.clipboardData || window.clipboardData).setData('text/plain', data);
    insertChar(caret.col, caret.ln, Chunk.charToCode(' ', Chunk.defaultForeground, Chunk.defaultBackground));
    e.preventDefault();
    fixCamera();
})

caret.undo = () => {
    if(!caret.editIndex) return;
    const prev = caret.edits[--caret.editIndex];
    insertChar(prev.col, prev.ln, prev.original, true);
    fixCamera();
    caret.acol = (caret.col = prev.col);
    caret.aln = (caret.ln = prev.ln);
}

caret.redo = () => {
    if(caret.editIndex == caret.edits.length) return;
    const next = caret.edits[caret.editIndex++];
    insertChar(next.col, next.ln, next.new, true);
    fixCamera();
    caret.acol = (caret.col = next.col + caret.colDir);
    caret.aln = (caret.ln = next.ln + caret.lnDir);
}

let isComposing = false;
if(!HUD.isTouchscreen) {
    const desktopTextArea = document.createElement('textarea');
    document.body.appendChild(desktopTextArea);
    desktopTextArea.style.position = 'absolute';
    desktopTextArea.style.left = '-100px';
    desktopTextArea.style.top = '-100px';
    desktopTextArea.style.width = '1px';
    desktopTextArea.style.height = '1px';
    desktopTextArea.focus();
    desktopTextArea.select();

    for(const ev of ['mousemove', 'mouseup', 'mousedown']) window.addEventListener(ev, e => {
        if(!isComposing) {
            desktopTextArea.focus()
            desktopTextArea.select();
        }
    });

    desktopTextArea.addEventListener('compositionstart', e => {
        isComposing = true;
    })
    desktopTextArea.addEventListener('compositionend', e => {
        if(e.data && isComposing) {
            isComposing = false;
            const key = e.data;
            if(key) caret.handleKeyPress({key, isTrusted: true, preventDefault() {}});
        }
    })
    desktopTextArea.addEventListener('input', e => {
        if(isComposing && e.inputType == 'insertText') {
            isComposing = false;
            const key = e.data;
            if(key) caret.handleKeyPress({key, isTrusted: true, preventDefault() {}});
        }
    })
}; 

const altMenu = {
    x: 0,
    y: 0,
    maxX: Object.getOwnPropertyNames(HUD.menus).length - 1,
    menu: null,
    item: null,
    subY: 0
}
const disableAltMenu = () => {
    altMenu.x = 0;
    altMenu.y = 0;
    altMenu.menu = null;
    altMenu.item = null;

    altMenu.subItem = null;
    altMenu.subY = 0;
    HUD.menus.altModeActive = false;
}
window.addEventListener('mousedown', disableAltMenu)
caret.handleKeyPress = e => {
    if(isComposing) return;
    if(Camera.refuseMovement) return;
    if(!e.isTrusted) return;
    if(
        (e.ctrlKey && e.key.toLowerCase() == 'v') ||
        (e.key == 'F12') ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() == 'i') ||
        (e.key == 'Dead')
    ) return;
    e.preventDefault();

    if(HUD.menus.altModeActive && e.key != 'F5') {
        let menu = altMenu.menu;
        let item = altMenu.item;
        let subItem = altMenu.subItem;

        const getMenu = x => HUD.menus[Object.getOwnPropertyNames(HUD.menus)[x]]

        switch(e.key) {
            case 'Alt' :
                disableAltMenu();
                break;
            case 'ArrowLeft' :
                if(altMenu.subItem) {
                    subItem = null;
                    altMenu.subY = 0;
                    break;
                }
                if(!altMenu.menu) altMenu.x = 1;
                else altMenu.x -= 1;
                altMenu.y = 0;
                if(altMenu.x < 1) altMenu.x = altMenu.maxX;
                menu = getMenu(altMenu.x);
                break;
            case 'ArrowRight' :
                if(!altMenu.menu) altMenu.x = 1;
                else if(!Array.isArray(altMenu.item) || altMenu.subItem) {
                    altMenu.x += 1;
                    subItem = null;
                    item = null;
                    altMenu.subY = 0;
                } else if(Array.isArray(altMenu.item)) {
                    subItem = altMenu.item[0][1];
                    altMenu.subY = 0;
                    break;
                }
                altMenu.y = 0;
                if(altMenu.x > altMenu.maxX) altMenu.x = 1;
                menu = getMenu(altMenu.x);
                break;
            case 'ArrowDown' :
                if(altMenu.subItem) {
                    altMenu.subY += 1;
                    altMenu.subY %= altMenu.item.length;
                    subItem = altMenu.item[altMenu.subY][1];
                    break;
                }
                if(!altMenu.menu) altMenu.x = 1;

                menu = getMenu(altMenu.x);
                altMenu.y += 1;
                if(altMenu.y > menu.items.length) altMenu.y = 1;
                item = menu.items[altMenu.y - 1][1];
                break;
            case 'ArrowUp' :
                if(altMenu.subItem) {
                    altMenu.subY -= 1;
                    if(altMenu.subY < 0) altMenu.subY = altMenu.item.length - 1;
                    subItem = altMenu.item[altMenu.subY][1];
                    break;
                }
                if(!altMenu.menu) altMenu.x = 1;

                menu = getMenu(altMenu.x);
                altMenu.y -= 1;
                if(altMenu.y < 1) altMenu.y = menu.items.length;
                item = menu.items[altMenu.y - 1][1];
                break;
            case ' ' :
            case 'Enter' :
                if(altMenu.subItem) {
                    altMenu.subItem.clickable.callback();
                    altMenu.subItem.clickable.hovered = false;
                    altMenu.item.clickable.hovered = false;
                    altMenu.menu.clickable.hovered = false;
                    altMenu.menu.clickable.callback();
                    disableAltMenu();
                } else if(altMenu.item && !Array.isArray(altMenu.item)) {
                    altMenu.item.clickable.callback();
                    altMenu.item.clickable.hovered = false;
                    altMenu.menu.clickable.hovered = false;
                    altMenu.menu.clickable.callback();
                    disableAltMenu();
                }
                return;
            default :
                if(e.key.length > 1) return;

                if(altMenu.menu) {
                    const found = menu.items.find(i => i[1].altKeyCode == e.key.toLowerCase());
                    if(found) item = found[1];
                    altMenu.y = menu.items.indexOf(found) + 1;
                }

                let i = 0;
                for(const k in HUD.menus) {
                    if(k == 'altModeActive') continue;
                    i++;
                    if(HUD.menus[k].altKey == e.key.toLowerCase()) {
                        item = null;
                        menu = HUD.menus[k];
                        altMenu.x = i;
                        altMenu.y = 0;
                        break;
                    }
                }
                break;
        }

        if(menu != altMenu.menu) {
            if(altMenu.menu) {
                altMenu.menu.clickable.callback();
                altMenu.menu.clickable.hovered = false;  
            }
            if(menu) {
                menu.clickable.callback();
                menu.clickable.hovered = true;
            }
            altMenu.menu = menu;
        }

        if(item != altMenu.item) {
            if(altMenu.item) {
                altMenu.item.clickable.hovered = false;
                if(Array.isArray(altMenu.item)) Draw.needsRedraw = true;
            }
            if(item) {
                item.clickable.hovered = true;
            } 
            altMenu.item = item;
        }

        if(subItem != altMenu.subItem) {
            if(altMenu.subItem) {
                altMenu.subItem.clickable.hovered = false;
            }
            if(subItem) {
                subItem.clickable.hovered = true;
            }
            altMenu.subItem = subItem;
        }
        return;
    }

    if(e.ctrlKey) {
        switch(e.key) {
            case 'Z' :
            case 'z' :
                if(e.shiftKey) for(let i = 0; i < 8; ++i) caret.undo();
                else caret.undo();
                break;
            case 'Y' :
            case 'y' :
                if(e.shiftKey) for(let i = 0; i < 8; ++i) caret.redo();
                else caret.redo();
                break;
            case 'ArrowUp' :
                if(!e.repeat) caret.ln = (caret.aln -= Math.floor(Draw.canvas.height / Chunk.unitHeight));
                fixCamera();
                break;
            case 'ArrowDown' :
                if(!e.repeat) caret.ln = (caret.aln += Math.floor(Draw.canvas.height / Chunk.unitHeight));
                fixCamera();
                break;
            case 'ArrowLeft' :
                if(!e.repeat) caret.col = (caret.acol -= Math.floor(Draw.canvas.width / Chunk.unitWidth));
                fixCamera();
                break;
            case 'ArrowRight' :
                if(!e.repeat) caret.col = (caret.acol += Math.floor(Draw.canvas.width / Chunk.unitWidth));
                fixCamera();
                break;
            case 's' :
                HUD.save(HUD.lastType);
                break;
            case 'p' :
                Draw.draw();
                Draw.processVisibleText();
                print();
                break;
            case 'C' :
            case 'c' :
                const cinfo = getCharAt(caret.col, caret.ln);
                if(!cinfo) break;
                const cdata = String.fromCharCode(cinfo.code & 0xffff) + (e.shiftKey ? `inf${String.fromCharCode((cinfo.code >> 16 & 0xf) + 1)}${String.fromCharCode((cinfo.code >> 20) + 1)}` : '');
                Help.copy(cdata);
                break;
            case 'X' :
            case 'x' :
                const xinfo = getCharAt(caret.col, caret.ln);
                if(!xinfo) break;
                const xdata = String.fromCharCode(xinfo.code & 0xffff) + (e.shiftKey ? `inf${String.fromCharCode((xinfo.code >> 16 & 0xf) + 1)}${String.fromCharCode((xinfo.code >> 20) + 1)}` : '');
                Help.copy(xdata);
                insertChar(caret.col, caret.ln, Chunk.charToCode(' ', Chunk.defaultForeground, Chunk.defaultBackground));
                break;
            case 'R' :
            case 'r' :
                caret.updateState(caret.col, caret.ln, false);
                window.location.reload(true);
                break;
            case '1' : case '2' : case '3' : case '4' : case '5' : case '6' : case '7' : case '8' :
                caret.colorFg = 16 - e.key;
                break;
            case 'u' :
                HUD.popUpInfo.text = Help.unicode.recentlyUsedCharacters;
                break;
            case '+' :
                if(Chunk.fontSize < 80) {
                    Camera.zoomTo({x: window.innerWidth / 2, y: window.innerHeight / 2}, {
                        x: (Camera.x + window.innerWidth / 2) / Chunk.unitWidth,
                        y: (Camera.y + window.innerHeight / 2) / Chunk.unitHeight
                    }, Chunk.fontSize + 4)
                }
                break;
            case '-' :
                if(Chunk.fontSize > 4) {
                    Camera.zoomTo({x: window.innerWidth / 2, y: window.innerHeight / 2}, {
                        x: (Camera.x + window.innerWidth / 2) / Chunk.unitWidth,
                        y: (Camera.y + window.innerHeight / 2) / Chunk.unitHeight
                    }, Chunk.fontSize - 4)
                }
                break;
        }
    } else {
        caret.blinkInd = 0;
        switch(e.key) {
            default : 
                if(e.key.length > 1) {
                    return;
                };
                insertChar(caret.col, caret.ln, Chunk.charToCode(e.key, caret.colorFg, caret.colorBg));
                applyDirection();
                break;
            case 'F5' :
                caret.updateState(caret.col, caret.ln, false);
                window.location.reload(true);
                break;
            case 'ArrowUp' : caret.aln = (caret.ln -= 1); caret.acol = caret.col; break;
            case 'ArrowLeft' : caret.acol = (caret.col -= 1); break;
            case 'ArrowRight' : caret.acol = (caret.col += 1); break;
            case 'ArrowDown' : caret.aln = (caret.ln += 1); caret.acol = caret.col; break;
            case 'Backspace' :
                applyDirection(-1);
            case 'Delete' :
                insertChar(caret.col, caret.ln, Chunk.charToCode(' ', Chunk.defaultForeground, Chunk.defaultBackground));
                break;
            case 'Enter' :
                const _shiftFact = e.shiftKey ? -1 : 1
                if(caret.colDir) {
                    caret.ln = (caret.aln += 1 * _shiftFact);
                    caret.col = caret.acol;
                } else if(caret.lnDir) {
                    caret.col = (caret.acol += 1 * _shiftFact);
                    caret.ln = caret.aln;
                }
                break;
            case 'Tab' :
                if(e.shiftKey) applyDirection(-4);
                else applyDirection(4);
                break;
            case 'PageUp' :
                if(!e.repeat) caret.ln = (caret.aln -= Math.floor(window.innerHeight / Chunk.unitHeight));
                break;
            case 'PageDown' :
                if(!e.repeat) caret.ln = (caret.aln += Math.floor(window.innerHeight / Chunk.unitHeight));
                break;
            case 'Home' :
                caret.ln = caret.aln;
            case 'End' :
                caret.col = caret.acol;
                break;
            case 'Alt' :
                for(const k in HUD.menus) {
                    if(k == 'altModeActive') continue;
                    if(HUD.menus[k].clickable.hovered) {
                        HUD.menus[k].clickable.callback();
                        HUD.menus[k].clickable.hovered = false;
                        HUD.menus[k].items.forEach(i => i[1].clickable.hovered = false);
                    }
                }
                HUD.menus.altModeActive = true;
                break;
        }
        fixCamera();
    }
}

window.addEventListener('keyup', e => e.key == 'Alt' && e.preventDefault());
window.addEventListener('keydown', caret.handleKeyPress);

export default caret;