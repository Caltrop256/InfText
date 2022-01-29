const exp = {
    wasm: null,

    curFunc: null,
    curCallback: () => {},

    allocateArray(typedArray) {
        const ptr = exp.wasm.exports.malloc(typedArray.byteLength);
        const view = new typedArray.constructor(exp.wasm.exports.memory.buffer, ptr, typedArray.length);
        view.set(typedArray);
        return ptr;
    },

    extractArray(ptr, type, len) {
        const out = new window[type + 'Array'](len);
        out.set(new window[type + 'Array'](exp.wasm.exports.memory.buffer, ptr, len));
        return out;
    }
};

exp.run = (func, callback, ...data) => {
    exp.curFunc = func;
    exp.curCallback = callback;
    exp.wasm.exports[func].apply(null, data);
}

WebAssembly.instantiateStreaming(
    fetch('./client.wasm'), {
        env: {
            callback(...data) {
                switch(exp.curFunc) {
                    case 'decodeChunkSequence' :
                        const [x0, x1, y0, y1, ptr] = data;
                        exp.curCallback(
                            (x0 | (x1 << 32n)) - 9223372036854775808n, 
                            (y0 | (y1 << 32n)) - 9223372036854775808n, 
                            exp.extractArray(ptr, 'Uint32', 50 * 25)
                        );
                        break;
                }
            }
        }
    }
).then(({instance}) => {
    exp.wasm = instance;
    exp.wasm.exports.memory.grow(10);

    import('./draw.mjs').then(draw => {

    }, err => {
        reveal(3);
        reveal(4).innerHTML += String(err) + ' ' + err.stack;
        reveal(4);
        reveal(5);
    });
});

globalThis.C = exp;
export default exp;