const fs = require('fs');
const files = fs.readdirSync('./backups').sort();

for(let i = 1, lowest = 0; i < files.length; ++i) {
    let j = i;
    const fileBuf = fs.readFileSync('./backups/' + files[i]);
    while(j --> lowest) {
        if(fileBuf.equals(fs.readFileSync('./backups/' + files[j]))) {
            console.log(files[i] + " is a duplicate of " + files[j]);
            fs.rmSync('./backups/' + files[i]);
            files.splice(i, 1);
            i -= 1;
            break;
        }
    }
}