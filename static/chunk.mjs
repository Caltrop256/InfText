import Letter from './letter.mjs';

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const exp = {
    rowSize: 50,
    colSize: 25,
    letter: Letter.putImageData,

    get colors() {return Letter.colors},
    get defaultBackground() {return Letter.defaultBackground},
    get defaultForeground() {return Letter.defaultForeground},
    get unitHeight() {return Letter.unitHeight},
    get unitWidth() {return Letter.unitWidth},
    get fontSize() {return Letter.fontSize},
    set fontFamily(v) {return Letter.fontFamily = v}
}
exp.changeFontSize = n => {
    exp.letter.changeFontSize(n);
    canvas.width = exp.rowSize * Letter.unitWidth;
    canvas.height = exp.colSize * Letter.unitHeight;
}
exp.changeFontSize(16);

exp.charToCode = (char, fg = Letter.defaultForeground, bg = Letter.defaultBackground) => {
    return char.charCodeAt(0) | (fg << 16) | (bg << 20)
}
const blank = exp.charToCode(' ', Letter.defaultForeground, Letter.defaultBackground);
exp.blank = blank;

exp.draw = chunk => {
    ctx.fillStyle = Letter.colors[Letter.defaultBackground];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for(let y = 0; y < exp.colSize; ++y) {
        for(let x = 0; x < exp.rowSize; ++x) {
            const code = chunk.lines[y][x];
            if(code && code != blank) exp.letter.draw(ctx, code, x * Letter.unitWidth, y * Letter.unitHeight);
        }
    }
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}


exp.fromUint32Array = arr => {
    const chunk = {
        lines: Array.from({length: exp.colSize}, () => []),
        imageData: null
    }
    for(let i = 0, y = 0; y < exp.colSize; ++y) {
        for(let x = 0; x < exp.rowSize; ++x, ++i) {
            chunk.lines[y][x] = arr[i];
        }
    }
    return chunk;
};

export default exp;