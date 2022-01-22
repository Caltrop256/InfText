import Caret from './caret.mjs'
import Chunk from './chunk.mjs'

let recentlyUsed = '';

const exp = {
    disconnected: '       You have been disconnected!\n' +
                  'Please wait while we try to reconnect you',
    introduction: [
        '\n', {txt: ' Welcome to InfText', fg: 13}, `

  An infinite canvas of text to edit and explore!
  All changes and edits you make are visible to
  all other visitors in real time!
  
  You can chose a foreground and background color
  to go with your text in the `, {txt: '[EDIT]', fg: 0, bg: 7}, ` menu or the 
  color-picker in the top-right!

  Express your truly insightful thoughts in writing  
  or draw something beautiful <3
                                             `, 
        {txt: '~sarah♥', fg: 13, callback() {window.open('https://twitter.com/Caltrop256', '_blank')}}, '\n',
'  ',   {txt: '[Source Code]', fg: 14, callback() {window.open('https://github.com/caltrop256/inftext', '_blank')}}, ' ', 
        {txt: '[Contact]', fg: 14, callback() {window.open('mailto:sarah@caltrop.dev', '_self')}}, '\n'

    ],
    controls: [
        '\n', {txt: ' Controls', fg: 13}, `

  Click & Drag the canvas to move around!
  Click anywhere to place the Caret.
  Use your keyboard to type onto the canvas.
  The direction the caret moves while typing 
  can  be set in the `, {txt: '[EDIT]', fg: 0, bg: 7}, ` menu!

  You may copy-paste one character at a time.
  Use the Unicode-Tables under the `, {txt: '[HELP]', fg: 0, bg: 7}, ` menu 
  
  `, 
  {txt: '←↑→', fg: 0, bg: 7}, `    move caret`, '        ', {txt: 'ctrl+c', fg: 0, bg: 7}, ` copy`, '\n  ',
  {txt: 'ctrl+→', fg: 0, bg: 7}, ` set caret to edge`, ' ', {txt: 'ctrl+v', fg: 0, bg: 7}, ` paste`, '\n  ',
  {txt: 'TAB', fg: 0, bg: 7}, `    4 spaces`, '          ', {txt: 'ctrl+x', fg: 0, bg: 7}, ` cut`, '\n  ',
  {txt: 'ENTER', fg: 0, bg: 7}, `  next line`, '         ', {txt: 'ctrl+z', fg: 0, bg: 7}, ` undo`, '\n  ',
  {txt: 'PgUp', fg: 0, bg: 7}, `   screen up`, '         ', {txt: 'ctrl+y', fg: 0, bg: 7}, ` redo`, '\n  ',
  {txt: 'PgDn', fg: 0, bg: 7}, `   screen down`, '       ', {txt: 'rmouse', fg: 0, bg: 7}, ` copy colors`, '\n  ',
  {txt: 'HOME', fg: 0, bg: 7}, `   return line`, '       ', {txt: 'mwheel', fg: 0, bg: 7}, ` font size`, '\n  ',
    ],
    coordinates: [
        '\n', {txt: ' Coordinates', fg: 13}, `
        
  You can view the current line and column of
  your Carret at the top-left of the screen!
  
  You may write down fast-travel links for quicker
  navigation. These are written in the format `, {txt: '@col,ln', fg: 0, bg: 7}, `

  `, {txt: '@-8008, 135', fg: 14, callback() {}}, ` would teleport your Caret to line 135 and 
  column -8008! `, {txt: '@0,0', fg: 14, callback() {}}, ` would teleport you to the center!
  
  Everyone is able to create and use these links!
  `
    ],
    unicode: {},

    copy(str) {
        const fallback = () => {
            const textArea = document.createElement("textarea");
            textArea.value = str;
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            try {
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
            } finally {
                document.body.removeChild(textArea);
            }
        }
        let promise = null;
        try {promise = navigator.clipboard.writeText(str);} catch(e) {fallback()};
        promise.catch(fallback);
    }
};

const table = str => {
    const a = ['\n  '];
    let i = 0;
    for(const char of str.split('')) {
        a.push({
            txt: char,
            fg: 15,
            bg: 0,
            callback() {
                exp.copy(char);
                Caret.insertChar(Caret.col, Caret.ln, Chunk.charToCode(char, Caret.colorFg, Caret.colorBg), false);
                Caret.applyDirection(1);
                
                const ind = recentlyUsed.indexOf(char);
                if(ind == -1) recentlyUsed = (char + recentlyUsed).substring(0, 64);
                else recentlyUsed = char + recentlyUsed.substring(0, ind) + recentlyUsed.substring(ind + 1);
                exp.unicode.recentlyUsedCharacters = table(recentlyUsed);
            }
        })
        a.push('  ');
        if(i++ == 15) {
            i = 0;
            a.push('\n\n  ');
        }
    }
    if(a[a.length - 1] == '\n\n  ') a.length = a.length - 1;
    a.push('\n');
    return a;
}

const range = (start, end) => {
    let str = '';
    for(let i = start; i <= end; ++i) str += String.fromCharCode(i);
    return str;
}

exp.unicode.recentlyUsedCharacters = '\n No recently used characters \n';

exp.unicode.arrows      = table(range(0x2190, 0x21ff) + range(0x27f0, 0x27ff));
exp.unicode.arrows2     = table(range(0x2900, 0x297f));
exp.unicode.arrowsMisc  = table(range(0x2b00, 0x2bff));
exp.unicode.boxElements = table(range(0x2580, 0x259f));
exp.unicode.boxDrawing  = table(range(0x2500, 0x257f));
exp.unicode.braille     = table(range(0x2800, 0x28ff));
exp.unicode.currency    = table(range(0x20a0, 0x20bf));
exp.unicode.dingbats    = table(range(0x2700, 0x27bf));
exp.unicode.enclosed    = table(range(0x2460, 0x24ff));
exp.unicode.geometry    = table(range(0x25a0, 0x25ff));
exp.unicode.math        = table(range(0x2200, 0x22ff));
exp.unicode.math2       = table(range(0x2a00, 0x2aff));
exp.unicode.mathLetters = table(range(0x2100, 0x214f));
exp.unicode.mathMisc    = table(range(0x27c0, 0x27ef) + range(0x2980, 0x29ff))
exp.unicode.misc        = table(range(0x2600, 0x26ff));
exp.unicode.technical   = table(range(0x2300, 0x23ff));

export default exp;