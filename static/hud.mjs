import Caret from './caret.mjs'
import Chunk from './chunk.mjs'
import Draw from './draw.mjs'
import Camera from './camera.mjs'
import Socket from './socket.mjs'
import Popups from './help.mjs'
import Letters from './letter.mjs'

let dirInd = 0;
const exp = {
    isTouchscreen: !!window.matchMedia("(pointer: coarse)").matches,

    top: 4 * Chunk.unitHeight,
    borderBg: 0,
    borderFg: 9,

    width: 0,
    height: 0,

    clickables: [],
    drawForeignCarets: true
};

if(exp.isTouchscreen) {
    Chunk.letter = Letters.drawImage;

    const inp = document.createElement('textarea');
    inp.style.position = 'absolute';
    inp.style.left = '0px';
    inp.style.top = '0px';
    inp.style.width = '100vw';
    inp.style.height = '100vh';
    inp.style.display = 'none';
    inp.value = '$';
    setTimeout(() => {
        window.removeEventListener('keydown', Caret.handleKeyPress);
        inp.addEventListener('input', e => {
            if(inp.value.length == 0) Caret.handleKeyPress({key: 'Backspace', isTrusted: true, preventDefault() {}});
            else if(inp.value.length > 1) {
                const trans = {
                    '\n': 'Enter',
                    '\t': 'Tab'
                }
                const char = inp.value.charAt(inp.value.length - 1);
                Caret.handleKeyPress({key: trans[char] || char, isTrusted: true, preventDefault() {}});
            }
            inp.value = '';
            inp.value = '$';
        })
    });
    const button = document.createElement('div');
    button.innerHTML = '[SHOW KEYBOARD]';
    button.style.zIndex = '1000';
    button.style.position = 'absolute';
    button.style.top = '90%';
    button.style.left = '10%';
    button.style.display = 'block';
    button.style.fontFamily = Chunk.fontFamily;
    button.style.fontSize = '12px';
    button.style.backgroundColor = Chunk.colors[7];
    button.style.color = Chunk.colors[0];
    const noPropagation = e => e.stopPropagation();
    for(const ev of ['click', 'mousemove', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchcancel', 'touchend']) {
        button.addEventListener(ev, noPropagation);
        window.addEventListener(ev, () => {
            if(inp.style.display == 'block') {
                inp.focus();
                inp.click();
            }
            button.style.fontSize = Chunk.fontSize + 'px';
        })
    }
    button.addEventListener('click', e => {
        if(inp.style.display == 'none') {
            inp.style.display = 'block';
            inp.focus();
            inp.click();
            button.innerHTML = '[HIDE KEYBOARD]';
        } else {
            inp.style.display = 'none';
            button.innerHTML = '[SHOW KEYBOARD]';
        }
    })
    Chunk.changeFontSize(12);

    document.body.appendChild(inp);
    document.body.appendChild(button);
}

const popUpInfo = {
    fg: null,
    bg: null,
    text: ''
}
exp.popUpInfo = popUpInfo;

const saveAsImage = type => {
    Draw.draw();
    Draw.processVisibleText();
    Draw.canvas.toBlob(blob => {
        exp.saveBlob(`export${Caret.col}_${Caret.ln}.${type.substring(type.lastIndexOf('/') + 1)}`, blob);
    }, type, type == 'image/jpeg' ? 0.0 : 1.0);
}

const save = type => {
    exp.lastType = type;
    if(type.startsWith('image/')) return saveAsImage(type);
    else if(type.startsWith('text/')) {
        const cw = Chunk.rowSize * Chunk.unitWidth;
        const ch = Chunk.colSize * Chunk.unitHeight;
    
        const cax = Math.floor(Camera.x / cw) - 1;
        const cay = Math.floor(Camera.y / ch) - 1;
        const cvpx = Math.ceil(window.innerWidth / cw) + cax + 2;
        const cvpy = Math.ceil(window.innerHeight / ch) + cay + 2;
    
        const chars = Array.from({length: (cvpy - cay) * Chunk.colSize}, () => {
            return Array.from({length: (cvpx - cax) * Chunk.rowSize}, () => Chunk.charToCode(' ', Chunk.defaultForeground, Chunk.defaultBackground));
        });

        for(let cy = cay; cy < cvpy; ++cy) {
            for(let cx = cax; cx < cvpx; ++cx) {
                if(!Draw.cache.has(cx + ',' + cy)) continue;
                const {lines} = Draw.cache.get(cx + ',' + cy);
                
                for(let ln = 0; ln < Chunk.colSize; ++ln) {
                    for(let col = 0; col < Chunk.rowSize; ++col) {
                        chars[(cy - cay) * Chunk.colSize + ln][(cx - cax) * Chunk.rowSize + col] = lines[ln][col];
                    }
                }
            }
        }

        if(type == 'text/plain') {
            exp.saveBlob(`inftext${Caret.col}_${Caret.ln}.txt`, new Blob([
                chars.map(c => c.map(t => String.fromCharCode(t & 0xffff).replace(/\s/, ' ')).join('')).join('\n')
            ], {type: 'text/plain;charset=utf8'}));
        } else if(type == 'text/html') {
            const replace = {
                '"': '&quot;',
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
            }
            let html = '<!DOCTYPE html>\n<html><head <meta charset="UTF-8"><style>body{margin:0;white-space:nowrap;background-color:#000000}span{line-height:100%;margin:0;height:18px;width:10px;overflow:hidden;font-family:"Courier New",monospace;font-size:16px}</style></head><body>';
            for(let y = 0; y < chars.length; ++y) {
                let cfg = -1;
                let cbg = -1;
                html += '<div>'
                for(let x = 0; x < chars[y].length; ++x) {
                    const fg = chars[y][x] >> 16 & 0xf;
                    const bg = chars[y][x] >> 20;
                    const char = String.fromCharCode(chars[y][x] & 0xffff);
                    if(cfg != fg || cbg != bg) {
                        cfg = fg;
                        cbg = bg;
                        html += `${x ? '</span>' : ''}<span style="color:${Chunk.colors[fg]};background-color:${Chunk.colors[bg]}">`;
                    }
                    html += char.replace(/["&<>]/, t => replace[t]).replace(/\s/, '&nbsp;')
                }
                html += '</span></div>';
            }
            html += '</body></html>';
            exp.saveBlob(`inftext${Caret.col}_${Caret.ln}.html`, new Blob([html], {type: 'text/html;charset=utf8'}));
        }
    }
}
exp.save = save;
exp.lastType = 'text/html';

const menus = {
    altModeActive: false,

    '[FILE]': {
        altKey: 'f',
        items: [
            ['o', 'open', () => window.open('github.com', '_blank')],
            ['s', 'save   (ctrl+s)', () => save(exp.lastType)],
            ['a', 'save as...', [
                ['.txt', save.bind(null, 'text/plain')],
                ['.html', save.bind(null, 'text/html')],
                ['.png', save.bind(null, 'image/png')],
                ['.jpeg', save.bind(null, 'image/jpeg')],
            ]],
            ['p', 'print  (ctrl+p)', () =>  {
                Draw.draw();
                Draw.processVisibleText();
                print();
            }],
            ['c', 'close', () => location.href = 'https://caltrop.dev/']
        ]
    },
    '[EDIT]': {
        altKey: 'e',
        items: [
            ['c', 'copy     (ctrl+c)', () => document.execCommand('copy')],
            ['p', 'paste    (ctrl+v)', () => popUpInfo.text = '\n Due to browser limitations you can currently only paste with ctrl+v \n'],
            ['t', 'cut      (ctrl+x)', () => document.execCommand('cut')],
            ['u', 'undo     (ctrl+z)', () => Caret.undo()],
            ['r', 'redo     (ctrl+y)', () => Caret.redo()],

            ['a', 'caret direction ', [
                ['left', () =>  {dirInd = 0;Caret.colDir = 1; Caret.lnDir = 0;}],
                ['right', () => {dirInd = 2;Caret.colDir = -1; Caret.lnDir = 0}],
                ['down', () =>  {dirInd = 1;Caret.colDir = 0;  Caret.lnDir = 1}],
                ['up', () =>    {dirInd = 3;Caret.colDir = 0; Caret.lnDir = -1}],
                ['none', () =>  {dirInd = 4;Caret.colDir = 0; Caret.lnDir = 0}]
            ]],

            ['g', 'foreground', [
                ['black', () => Caret.colorFg = 0],
                ['dark red', () => Caret.colorFg = 1],
                ['dark green', () => Caret.colorFg = 2],
                ['gold', () => Caret.colorFg = 3],
                ['dark blue', () => Caret.colorFg = 4],
                ['magenta', () => Caret.colorFg = 5],
                ['aqua', () => Caret.colorFg = 6],
                ['grey', () => Caret.colorFg = 7],
                ['gray', () => Caret.colorFg = 8],
                ['bright red', () => Caret.colorFg = 9],
                ['bright green', () => Caret.colorFg = 10],
                ['yellow', () => Caret.colorFg = 11],
                ['blue', () => Caret.colorFg = 12],
                ['light magenta', () => Caret.colorFg = 13],
                ['cyan', () => Caret.colorFg = 14],
                ['white', () => Caret.colorFg = 15],
            ]],
            ['b', 'background', [
                ['black', () => Caret.colorBg = 0],
                ['dark red', () => Caret.colorBg = 1],
                ['dark green', () => Caret.colorBg = 2],
                ['gold', () => Caret.colorBg = 3],
                ['dark blue', () => Caret.colorBg = 4],
                ['magenta', () => Caret.colorBg = 5],
                ['aqua', () => Caret.colorBg = 6],
                ['grey', () => Caret.colorBg = 7],
                ['gray', () => Caret.colorBg = 8],
                ['bright red', () => Caret.colorBg = 9],
                ['bright green', () => Caret.colorBg = 10],
                ['yellow', () => Caret.colorBg = 11],
                ['blue', () => Caret.colorBg = 12],
                ['light magenta', () => Caret.colorBg = 13],
                ['cyan', () => Caret.colorBg = 14],
                ['white', () => Caret.colorBg = 15],
            ]]
        ]
    },
    '[NAVIGATE]': {
        altKey: 'n',
        items: [
            ['c', 'return to center', () => {
                Camera.teleportTo(0, 0);
            }],
            ['u', 'undo teleport', () => typeof history.state.x != 'undefined' && history.back(1)],
            ['r', 'redo teleport', () => history.go(1)],
            ['t', 'teleport 100', [
                ['up', () => {const x = Caret.col, y = Caret.ln - 100; Camera.teleportTo(x, y);}],
                ['down', () => {const x = Caret.col, y = Caret.ln + 100; Camera.teleportTo(x, y);}],
                ['left', () => {const x = Caret.col - 100, y = Caret.ln; Camera.teleportTo(x, y);}],
                ['right', () => {const x = Caret.col + 100, y = Caret.ln; Camera.teleportTo(x, y);}]
            ]],
            ['1', 'teleport 1000', [
                ['up', () => {const x = Caret.col, y = Caret.ln - 1000; Camera.teleportTo(x, y);}],
                ['down', () => {const x = Caret.col, y = Caret.ln + 1000; Camera.teleportTo(x, y);}],
                ['left', () => {const x = Caret.col - 1000, y = Caret.ln; Camera.teleportTo(x, y);}],
                ['right', () => {const x = Caret.col + 1000, y = Caret.ln; Camera.teleportTo(x, y);}]
            ]],
            ['s', 'scroll speed', [
                ['slow', () => Camera.scrollSpeedModifier = 0.25],
                ['regular', () => Camera.scrollSpeedModifier = 0.5],
                ['fast', () => Camera.scrollSpeedModifier = 1]
            ]],
            ['m', 'smooth scroll   ✓', () => {
                menus['[NAVIGATE]'].items.find(i => i[0].startsWith('smooth scroll'))[0] = 'smooth scroll   '
                    + ((Camera.smoothScroll = !Camera.smoothScroll) ? '✓' : '✗');
            }]
        ]
    },
    '[DISPLAY]': {
        altKey: 'd',
        items: [
            ['c', 'foreign carets     ✓', () => {
                menus['[DISPLAY]'].items.find(i => i[0].startsWith('foreign carets'))[0] = 'foreign carets  '
                    + ((exp.drawForeignCarets = !exp.drawForeignCarets) ? '✓' : '✗');
                    if(exp.drawForeignCarets) Socket.postMessage(JSON.stringify({pos: {ln: Caret.ln, col: Caret.col}}));
                    else Socket.postMessage(JSON.stringify({pos: null}));
            }],
            ['i', 'inf caret cycle    ✓', () => {
                menus['[DISPLAY]'].items.find(i => i[0].startsWith('inf caret cycle'))[0] = 'inf caret cycle    '
                    + ((Draw.caretInfiniteBlink = !Draw.caretInfiniteBlink) ? '✓' : '✗');
            }],
            ['t', 'fit font           ✓', () => {
                menus['[DISPLAY]'].items.find(i => i[0].startsWith('fit font'))[0] = 'fit font           '
                    + ((Letters.fitFont = !Letters.fitFont) ? '✓' : '✗');
                Chunk.changeFontSize(Chunk.fontSize);
                Draw.cache.forEach(c => c.imageData = null);
                Draw.needsRedraw = true;
            }],
            ['s', 'size (ctrl+mwheel)  ', [
                ...[4, 8, 12, 16, 24, 32, 40, 56, 80].map(n => [n.toString().padStart(2, '0'), () => Camera.zoomTo({x: window.innerWidth / 2, y: window.innerHeight / 2}, {
                    x: (Camera.x + window.innerWidth / 2) / Chunk.unitWidth,
                    y: (Camera.y + window.innerHeight / 2) / Chunk.unitHeight
                }, n)])
            ]],
            ['o', 'font', [
                ['default', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = '"Courier New",monospace,Courier'), Draw.cache.forEach(c => c.imageData = null))],
                ['courier new', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = '"Courier New"'), Draw.cache.forEach(c => c.imageData = null))],
                ['courier', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = 'Courier'), Draw.cache.forEach(c => c.imageData = null))],
                ['monaco', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = 'monaco'), Draw.cache.forEach(c => c.imageData = null))],
                ['monospace', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = 'monospace'), Draw.cache.forEach(c => c.imageData = null))],
                ['andalé mono', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = '"Andalé Mono"'), Draw.cache.forEach(c => c.imageData = null))],
                ['lucida console', () => Chunk.changeFontSize(Chunk.fontSize, localStorage.setItem('font', Chunk.fontFamily = '"Lucida Console"'), Draw.cache.forEach(c => c.imageData = null))],
            ]],
            ['e', 'color scheme', [
                ['default', () => {localStorage.setItem('scheme', 'default'); Letters.colors = Letters.colorVariations.default; Chunk.changeFontSize(Chunk.fontSize); Draw.cache.forEach(c => c.imageData = null)}],
                ['legacy', () => {localStorage.setItem('scheme', 'legacy'); Letters.colors = Letters.colorVariations.legacy; Chunk.changeFontSize(Chunk.fontSize); Draw.cache.forEach(c => c.imageData = null);}]
            ]]
        ]
    },
    '[HELP]': {
        altKey: 'h',
        items: [
            ['i', 'introduction', () => popUpInfo.text = Popups.introduction],
            ['c', 'controls', () => popUpInfo.text = Popups.controls],
            ['s', 'coordinates', () => popUpInfo.text = Popups.coordinates],
            ['u', 'unicode table  ', [
                ['recent  (ctrl+u)', () => popUpInfo.text = Popups.unicode.recentlyUsedCharacters],
                ['arrows a', () => popUpInfo.text = Popups.unicode.arrows],
                ['arrows b', () => popUpInfo.text = Popups.unicode.arrows2],
                ['arrows c', () => popUpInfo.text = Popups.unicode.arrowsMisc],
                ['box drawing', () => popUpInfo.text = Popups.unicode.boxDrawing],
                ['box elements', () => popUpInfo.text = Popups.unicode.boxElements],
                ['braille', () => popUpInfo.text = Popups.unicode.braille],
                ['currency', () => popUpInfo.text = Popups.unicode.currency],
                ['enclosed', () => popUpInfo.text = Popups.unicode.enclosed],
                ['geometry', () => popUpInfo.text = Popups.unicode.geometry],
                ['math a', () => popUpInfo.text = Popups.unicode.math],
                ['math b', () => popUpInfo.text = Popups.unicode.math2],
                ['math letters', () => popUpInfo.text = Popups.unicode.mathLetters],
                ['math misc', () => popUpInfo.text = Popups.unicode.mathMisc],
                ['ornaments', () => popUpInfo.text = Popups.unicode.dingbats],
                ['technical', () => popUpInfo.text = Popups.unicode.technical],
                ['various', () => popUpInfo.text = Popups.unicode.misc]
            ]]
        ]
    },
}
exp.menus = menus;

let menuX = 2;
for(const name in menus) {
    if(name == 'altModeActive') continue;
    menus[name].width = Math.max(...menus[name].items.map(i => i[1].length)) + 1;
    menus[name].showItems = false;
    menus[name].clickable = {
        fixed: true,
        sln: 3, eln: 3,
        scol: menuX, ecol: menuX + name.length - 1,
        callback() {
            menus[name].showItems = !menus[name].showItems;
            let y = 4;
            for(const item of menus[name].items) {
                item[1].clickable.eln = menus[name].showItems ? (y++) : -1;
            }
            if(!menus[name].showItems) Draw.needsRedraw = true;
        }
    }
    let y = 4;
    for(const item of menus[name].items) item[2].altKeyCode = item.shift();
    for(const item of menus[name].items) {
        item[1].clickable = {
            fixed: true,
            sln: y, eln: -1,
            scol: menuX, ecol: menuX + menus[name].width - 1,
            callback: item[1]
        }
        exp.clickables.push(item[1].clickable);

        if(Array.isArray(item[1])) {
            item[1].clickable.callback = () => 'NOCLOSE';
            item[1].width = Math.max(...item[1].map(i => i[0].length)) + 1;

            let dy = 0;
            for(const [text, callback] of item[1]) {
                callback.clickable = {
                    fixed: true,
                    sln: y + dy, eln: -1,
                    scol: menuX + menus[name].width, ecol: menuX + menus[name].width + item[1].width - 1,
                    callback() {
                        callback();
                        for(const [, callback] of item[1]) callback.clickable.eln = -1;
                    }
                };
                exp.clickables.push(callback.clickable);
                dy += 1;
            }
        }

        y += 1;
    }
    exp.clickables.push(menus[name].clickable);

    menuX += name.length + 1;
}

const dirClickable = {
    fixed: true,
    callback() {
        dirInd += 1;
        dirInd %= 5;
        switch(dirInd) {
            case 0 :
                Caret.lnDir = 0;
                Caret.colDir = 1;
                break;
            case 1 :
                Caret.lnDir = 1;
                Caret.colDir = 0;
                break;
            case 2 :
                Caret.lnDir = 0;
                Caret.colDir = -1;
                break;
            case 3 :
                Caret.lnDir = -1;
                Caret.colDir = 0;
                break;
            case 4 :
                Caret.lnDir = 0;
                Caret.colDir = 0;
                break;
        }
        Caret.acol = Caret.col;
        Caret.aln = Caret.ln;
    }
}
exp.clickables.push(dirClickable);
const bgClickable = {
    fixed: true,
    callback(col, ln) {
        Caret.colorBg = col;
        localStorage.setItem('cbg', col);
    }
}
exp.clickables.push(bgClickable);
const fgClickable = {
    fixed: true,
    callback(col, ln) {
        Caret.colorFg = col;
        localStorage.setItem('cfg', col);
    }
}
exp.clickables.push(fgClickable);

window.addEventListener('mousemove', e => {
    const fln = Math.floor((e.clientY - Draw.canvas.offsetTop) / Chunk.unitHeight);
    const fcol = Math.floor((e.clientX - Draw.canvas.offsetLeft) / Chunk.unitWidth);
    const ln = Math.floor((Camera.y + (e.clientY - Draw.canvas.offsetTop)) / Chunk.unitHeight);
    const col = Math.floor((Camera.x + (e.clientX - Draw.canvas.offsetLeft)) / Chunk.unitWidth);

    let found = false;
    for(let i = 0; i < exp.clickables.length; ++i) {
        const c = exp.clickables[i];
        if(c.fixed) {
            const prev = c.hovered;
            if(c.hovered = (c.sln <= fln && fln <= c.eln && c.scol <= fcol && fcol <= c.ecol)) {
                document.body.style.cursor = 'pointer';
                found = true;
            } else if(prev) Draw.needsRedraw = true;
        } else if(c.hovered = (e.clientY >= exp.top && c.sln <= ln && ln <= c.eln && c.scol <= col && col <= c.ecol)) {
            document.body.style.cursor = 'pointer';
            found = true;
        }
    }

    if(!found) {
        if(Camera.isMoving) document.body.style.cursor = 'move';
        else document.body.style.cursor = 'text';
    }
})

exp.saveBlob = (name, blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(a.href), 60 * 1000);
    a.download = name;
    a.rel = 'noopener';
    try {
        a.dispatchEvent(new MouseEvent('click'))
    } catch(_) {
        const e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, true, globalThis, 0, 0, 0, 80, 20, false, false, false, false, 0, null);
        a.dispatchEvent(e)
    }
}

window.addEventListener('mouseup', e => {
    const fln = Math.floor((e.clientY - Draw.canvas.offsetTop) / Chunk.unitHeight);
    const fcol = Math.floor((e.clientX - Draw.canvas.offsetLeft) / Chunk.unitWidth);
    const ln = Math.floor((Camera.y + (e.clientY - Draw.canvas.offsetTop)) / Chunk.unitHeight);
    const col = Math.floor((Camera.x + (e.clientX - Draw.canvas.offsetLeft)) / Chunk.unitWidth);

    if(popUpInfo.text.length) {
        popUpInfo.text = '';
        Draw.needsRedraw = true;
    }
    let ref = null;

    for(let i = 0; i < exp.clickables.length; ++i) {
        const c = exp.clickables[i];
        if(c.fixed) {
            if(c.sln <= fln && fln <= c.eln && c.scol <= fcol && fcol <= c.ecol) {
                e.stopImmediatePropagation();
                Camera.isMoving = false;
                document.body.style.cursor = 'pointer';
                if(c.callback(fcol - c.scol, fln - c.sln, e) == 'NOCLOSE') return;
                ref = c;
                break;
            }
        } else if(e.clientY >= exp.top && c.sln <= ln && ln <= c.eln && c.scol <= col && col <= c.ecol) {
            e.stopImmediatePropagation();
            Camera.isMoving = false;
            document.body.style.cursor = 'pointer';
            c.callback(col - c.scol, ln - c.sln, e);
            break;
        }
    }

    for(const name in menus) {
        if(menus[name].showItems && ref != menus[name].clickable) menus[name].clickable.callback();
    }
})

const popup = (canvas, ctx, inp) => {
    const width = Math.floor(canvas.width / Chunk.unitWidth);
    const height = Math.floor(canvas.height / Chunk.unitHeight);

    const text = [];
    for(const v of inp) typeof v == 'string' ? text.push.apply(text, v.split('')) : text.push(v);

    const lines = [[]];
    const clickables = [];
    for(let i = 0, y = 0, x = 0; i < text.length; ++i) {
        const char = text[i];
        if(typeof char == 'object') {
            const bg = typeof char.bg == 'number' ? char.bg : exp.borderBg;
            const fg = typeof char.fg == 'number' ? char.fg : exp.borderFg;
            if(typeof char.callback == 'function') clickables.push({x, y, len: char.txt.replace(/\n/g, '').length, callback: char.callback});
            for(let j = 0; j < char.txt.length; ++j) {
                const ch = char.txt.charAt(j);
                if(ch == '\n') {
                    lines[++y] = [];
                    x = 0;
                } else lines[y][x++] = Chunk.charToCode(ch, fg, bg);
            }
        } else if(char == '\n') {
            lines[++y] = [];
            x = 0;
        } else lines[y][x++] = Chunk.charToCode(char, exp.borderFg, exp.borderBg);
    }

    const yLength = lines.length + 1;
    const xLength = Math.max(...lines.map(a => a.length)) + 1;

    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);

    const windowLeft = Math.floor(centerX - xLength / 2);
    const windowRight = Math.floor(centerX + xLength / 2);
    const windowTop = Math.floor(centerY - yLength / 2);
    const windowBottom = Math.floor(centerY + yLength / 2);

    exp.clickables = exp.clickables.filter(c => !c.popup);
    for(const c of clickables) {
        exp.clickables.push({
            fixed: true, popup: true,
            sln: windowTop + 1 + c.y, eln: windowTop + 1 + c.y,
            scol: windowLeft + 1 + c.x, ecol: windowLeft + c.x + c.len,
            callback: c.callback
        })
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(
        (windowLeft - 1) * Chunk.unitWidth, 
        (windowTop - 1) * Chunk.unitHeight, 
        (windowRight - windowLeft + 3) * Chunk.unitWidth,
        (windowBottom - windowTop + 3) * Chunk.unitHeight
    );

    const horizontalBlockCode = Chunk.charToCode('═', exp.borderFg, exp.borderBg);
    for(let x = windowLeft + 1; x < windowRight; ++x) {
        Chunk.letter.draw(ctx, horizontalBlockCode, x * Chunk.unitWidth, windowTop * Chunk.unitHeight);
        Chunk.letter.draw(ctx, horizontalBlockCode, x * Chunk.unitWidth, (windowBottom) * Chunk.unitHeight);
    }
    const verticalBlockCode = Chunk.charToCode('║', exp.borderFg, exp.borderBg);
    for(let y = windowTop + 1; y < windowBottom; ++y) {
        Chunk.letter.draw(ctx, verticalBlockCode, windowLeft * Chunk.unitWidth, y * Chunk.unitHeight);
        Chunk.letter.draw(ctx, verticalBlockCode, (windowRight) * Chunk.unitWidth, y * Chunk.unitHeight);
    }
    Chunk.letter.draw(ctx, Chunk.charToCode('╔', exp.borderFg, exp.borderBg), windowLeft * Chunk.unitWidth, windowTop * Chunk.unitHeight);
    Chunk.letter.draw(ctx, Chunk.charToCode('╗', exp.borderFg, exp.borderBg), windowRight * Chunk.unitWidth, windowTop * Chunk.unitHeight);
    Chunk.letter.draw(ctx, Chunk.charToCode('╝', exp.borderFg, exp.borderBg), windowRight * Chunk.unitWidth, windowBottom * Chunk.unitHeight);
    Chunk.letter.draw(ctx, Chunk.charToCode('╚', exp.borderFg, exp.borderBg), windowLeft * Chunk.unitWidth, windowBottom * Chunk.unitHeight);

    for(let ln = 0; ln < lines.length; ++ln) {
        for(let col = 0; col < lines[ln].length; ++col) {
            Chunk.letter.draw(ctx, lines[ln][col], (windowLeft + col + 1) * Chunk.unitWidth, (windowTop + ln + 1) * Chunk.unitHeight)
        }
    }
}

const drawMenus = (canvas, ctx) => {
    const drawCodes = (codes, x, y) => {
        for(let i = 0; i < codes.length; ++i) {
            Chunk.letter.draw(ctx, codes[i], (x + i) * Chunk.unitWidth, y * Chunk.unitHeight);
        }
    }
    const stringToCodes = (str, fg, bg) => str.split('').map(c => Chunk.charToCode(c, fg, bg));

    let x = 2;
    for(const name in menus) {
        if(name == 'altModeActive') continue;
        drawCodes(stringToCodes(name, menus[name].clickable.hovered ? 15 : 0, menus[name].clickable.hovered ? 4 : 7), x, 3);
        if(menus.altModeActive) {
            ctx.fillStyle = Chunk.colors[menus[name].clickable.hovered ? 15 : 0];
            ctx.fillRect((x + 1) * Chunk.unitWidth, 3 * Chunk.unitHeight + Chunk.unitHeight - 3, Chunk.unitWidth, 2);
        }
        if(menus[name].showItems) {
            for(let y = 0; y < menus[name].items.length; ++y) {
                const [text, callback] = menus[name].items[y];
                drawCodes(stringToCodes(' ' + text.padEnd(menus[name].width - 1, ' '), callback.clickable.hovered ? 15 : 0, callback.clickable.hovered ? 4 : 8), x, y + 4);
                if(Array.isArray(callback)) {
                    drawCodes(stringToCodes('>', callback.clickable.hovered ? 15 : 0, callback.clickable.hovered ? 4 : 8), x + menus[name].width - 1, y + 4);
                    if(callback.clickable.hovered || callback.some(e => e[1].clickable.hovered)) {
                        for(let dy = 0; dy < callback.length; ++dy) {
                            const [text, info] = callback[dy];
                            info.clickable.eln = 4 + y + dy;
                            drawCodes(stringToCodes(' ' + text.padEnd(callback.width - 1, ' '), info.clickable.hovered ? 15 : 0, info.clickable.hovered ? 4 : 8), x + menus[name].width, y + dy + 4);
                        }
                    } else {
                        callback.forEach(e => e[1].clickable.eln = -1);
                    }
                }

                if(menus.altModeActive) {
                    ctx.fillStyle = Chunk.colors[callback.clickable.hovered ? 15 : 0];
                    const ind = text.indexOf(callback.altKeyCode);
                    //console.log(text, ind);
                    ctx.fillRect((x + 1 + ind) * Chunk.unitWidth, (y + 4) * Chunk.unitHeight + Chunk.unitHeight - 3, Chunk.unitWidth, 2)
                }
            }
        }

        x += name.length + 1;
    }
}

exp.draw = (canvas, ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, exp.top);
    const width = Math.floor(canvas.width / Chunk.unitWidth);
    const height = Math.floor(canvas.height / Chunk.unitHeight);
    exp.width = width;
    exp.height = height;

    const horizontalBlockCode = Chunk.charToCode('═', exp.borderFg, exp.borderBg);
    for(let x = 1; x < width - 1; ++x) {
        Chunk.letter.draw(ctx, horizontalBlockCode, x * Chunk.unitWidth, 0);
        Chunk.letter.draw(ctx, horizontalBlockCode, x * Chunk.unitWidth, exp.top - Chunk.unitHeight);
        Chunk.letter.draw(ctx, horizontalBlockCode, x * Chunk.unitWidth, canvas.height - Chunk.unitHeight);
    }
    const verticalBlockCode = Chunk.charToCode('║', exp.borderFg, exp.borderBg);
    for(let y = 1; y < height - 1; ++y) {
        Chunk.letter.draw(ctx, verticalBlockCode, 0, y * Chunk.unitHeight);
        Chunk.letter.draw(ctx, verticalBlockCode, canvas.width - Chunk.unitWidth, y * Chunk.unitHeight);
    }
    Chunk.letter.draw(ctx, Chunk.charToCode('╔', exp.borderFg, exp.borderBg), 0, 0);
    Chunk.letter.draw(ctx, Chunk.charToCode('╗', exp.borderFg, exp.borderBg), canvas.width - Chunk.unitWidth, 0);
    Chunk.letter.draw(ctx, Chunk.charToCode('╚', exp.borderFg, exp.borderBg), 0, canvas.height - Chunk.unitHeight);
    Chunk.letter.draw(ctx, Chunk.charToCode('╝', exp.borderFg, exp.borderBg), canvas.width - Chunk.unitWidth, canvas.height - Chunk.unitHeight);
    Chunk.letter.draw(ctx, Chunk.charToCode('╠', exp.borderFg, exp.borderBg), 0, exp.top - Chunk.unitHeight);
    Chunk.letter.draw(ctx, Chunk.charToCode('╣', exp.borderFg, exp.borderBg), canvas.width - Chunk.unitWidth, exp.top - Chunk.unitHeight);

    const drawCodes = (codes, x, y) => {
        for(let i = 0; i < codes.length; ++i) {
            Chunk.letter.draw(ctx, codes[i], (x + i) * Chunk.unitWidth, y * Chunk.unitHeight);
        }
    }
    
    const stringToCodes = (str, fg, bg) => str.split('').map(c => Chunk.charToCode(c, fg, bg));

    drawCodes(stringToCodes(`ln:  ${Caret.ln}`, 15, 0), 1, 2);
    drawCodes(stringToCodes(`col: ${Caret.col}`, 15, 0), 1, 1);

    if(width >= 50) {
        for(let i = 0; i < Chunk.colors.length; ++i) {
            Chunk.letter.draw(ctx, Chunk.charToCode(' ', 0, i), (canvas.width - (Chunk.colors.length + 1) * Chunk.unitWidth) + i * Chunk.unitWidth, Chunk.unitHeight);
        }
        drawCodes(stringToCodes('bg: ', 15, 0), width - Chunk.colors.length - 4, 1);
        drawCodes(stringToCodes('^', 15, 0), width - (15 - Caret.colorBg) - 2, 2);
        drawCodes([Chunk.charToCode('╦', exp.borderFg, exp.borderBg)], width - 21, 0);
        drawCodes([Chunk.charToCode('║', exp.borderFg, exp.borderBg)], width - 21, 1);
        drawCodes([Chunk.charToCode('║', exp.borderFg, exp.borderBg)], width - 21, 2);
        drawCodes([Chunk.charToCode('╩', exp.borderFg, exp.borderBg)], width - 21, 3);
        for(let i = 0; i < Chunk.colors.length; ++i) {
            Chunk.letter.draw(ctx, Chunk.charToCode(' ', 0, i), (canvas.width - (Chunk.colors.length + 1) * Chunk.unitWidth * 2) + i * Chunk.unitWidth - Chunk.unitWidth * 3, Chunk.unitHeight);
        }
        bgClickable.sln = 0;
        bgClickable.eln = 3;
        bgClickable.scol = width - 17;
        bgClickable.ecol = width - 2;
        drawCodes(stringToCodes('fg: ', 15, 0), width - Chunk.colors.length * 2 - 8, 1);
        drawCodes(stringToCodes('^', 15, 0), width - 37 + Caret.colorFg, 2);
        drawCodes([Chunk.charToCode('╦', exp.borderFg, exp.borderBg)], width - 41, 0);
        drawCodes([Chunk.charToCode('║', exp.borderFg, exp.borderBg)], width - 41, 1);
        drawCodes([Chunk.charToCode('║', exp.borderFg, exp.borderBg)], width - 41, 2);
        drawCodes([Chunk.charToCode('╩', exp.borderFg, exp.borderBg)], width - 41, 3);
        fgClickable.sln = 0;
        fgClickable.eln = 3;
        fgClickable.scol = width - 37;
        fgClickable.ecol = width - 22;
    }

    if(width >= 60) {
        drawCodes(stringToCodes('DIR', 15, 0), width - 44, 1);
        drawCodes(stringToCodes('[' + ['>', 'v', '<', '^', ' '][dirInd] + ']', 15, 0), width - 44, 2);
        drawCodes([Chunk.charToCode('╦', exp.borderFg, exp.borderBg)], width - 45, 0);
        drawCodes([Chunk.charToCode('║', exp.borderFg, exp.borderBg)], width - 45, 1);
        drawCodes([Chunk.charToCode('║', exp.borderFg, exp.borderBg)], width - 45, 2);
        drawCodes([Chunk.charToCode('╩', exp.borderFg, exp.borderBg)], width - 45, 3);
        dirClickable.sln = 0;
        dirClickable.eln = 3;
        dirClickable.scol = width - 44;
        dirClickable.ecol = width - 42;
    }

    if(width >= 65) {
        drawCodes(stringToCodes(`${Socket.totalOnline}♥`.padStart(5, ' '), 15, 0), width - 50, 1);
        drawCodes(stringToCodes(`${Draw.foreignCarets.size + 1}♪`.padStart(5, ' '), 15, 0), width - 50, 2);
    }

    drawMenus(canvas, ctx);

    if(Socket._connectionState == 0) popup(canvas, ctx, Popups.disconnected); 
    else if(Socket._connectionState == -2) popup(canvas, ctx, Popups.ratelimit);
    else if(popUpInfo.text.length) popup(canvas, ctx, popUpInfo.text);
}

export default exp;