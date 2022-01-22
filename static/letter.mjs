const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const exp = {
    defaultBackground: 0,
    defaultForeground: 15,
    fontSize: 16,
    fontFamily: '"Courier New",monospace,Courier',
    fitFont: true,
    colors: [
        '#000000',
        '#800000',
        '#008000',
        '#808000',
        '#000080',
        '#800080',
        '#008080',
        '#c0c0c0',
        '#808080',
        '#ff0000',
        '#00ff00',
        '#ffff00',
        '#0000ff',
        '#ff00ff',
        '#00ffff',
        '#ffffff'
    ],
}

exp.drawImage = (() => {
    const letterTable = new Map();

    const changeFontSize = n => {
        canvas.width = 1024;
        canvas.height = 1024;
        exp.fontSize = n;
        exp.unitHeight = exp.fontSize + 2;
        exp.unitWidth = Math.floor(exp.unitHeight * 0.6);
        ctx.textBaseline = 'top';
        ctx.font = exp.fontSize + 'px ' + exp.fontFamily;
        ctx.fillStyle = exp.colors[exp.defaultForeground];
        letterTable.clear();
    }

    const letterInd = {
        x: 0,
        y: 0
    }
    const add = code => {
        if(letterInd.x + exp.unitWidth >= canvas.width) {
            letterInd.x = 0;
            letterInd.y += exp.unitHeight;
            if(letterInd.y + exp.unitHeight >= canvas.height) {
                letterInd.y = 0;
                letterTable.clear();
            }
        }
        ctx.fillStyle = exp.colors[code >> 20];
        ctx.fillRect(letterInd.x, letterInd.y, exp.unitWidth, exp.unitHeight);
        ctx.fillStyle = exp.colors[code >> 16 & 0xf];
        ctx.fillText(String.fromCharCode(code & 0xffff), letterInd.x, letterInd.y + 2, exp.fitFont ? exp.unitWidth : void 0);
        const pos = {x: letterInd.x, y: letterInd.y};
        letterTable.set(code, pos);
        letterInd.x += exp.unitWidth;
        return pos;
    }

    const draw = (ctx, code, dx, dy) => {
        const src = letterTable.get(code) || add(code);
        ctx.drawImage(
            canvas,
            src.x, src.y,
            exp.unitWidth, exp.unitHeight,
            dx, dy,
            exp.unitWidth, exp.unitHeight
        )
    }

    const getImageData = code => {
        const src = letterTable.get(code) || add(code);
        return ctx.getImageData(src.x, src.y, exp.unitWidth, exp.unitHeight);
    }

    return {
        changeFontSize,
        add,
        draw,
        getImageData
    }
})();

exp.putImageData = (() => {
    const letterTable = new Map();

    const changeFontSize = n => {
        exp.fontSize = n;
        exp.unitHeight = exp.fontSize + 2;
        exp.unitWidth = Math.floor(exp.unitHeight * 0.6);
        canvas.width = exp.unitWidth;
        canvas.height = exp.unitHeight;
        ctx.textBaseline = 'top';
        ctx.font = exp.fontSize + 'px ' + exp.fontFamily;
        ctx.fillStyle = exp.colors[exp.defaultForeground];
        letterTable.clear();
    }

    const add = code => {
        ctx.fillStyle = exp.colors[code >> 20];
        ctx.fillRect(0, 0, exp.unitWidth, exp.unitHeight);
        ctx.fillStyle = exp.colors[code >> 16 & 0xf];
        ctx.fillText(String.fromCharCode(code & 0xffff), 0, 2, exp.fitFont ? exp.unitWidth : void 0);
        const data = ctx.getImageData(0, 0, exp.unitWidth, exp.unitHeight);
        letterTable.set(code, data);
        return data;
    }

    const draw = (ctx, code, dx, dy) => {
        const data = letterTable.get(code) || add(code);
        ctx.putImageData(data, dx, dy);
    }

    const getImageData = code => letterTable.get(code) || add(code);

    return {
        changeFontSize,
        add,
        draw,
        getImageData
    }
})();


export default exp;