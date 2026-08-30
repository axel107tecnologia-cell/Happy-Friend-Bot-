const fs = require('fs');
const { spawn } = require('child_process');

async function writeExifImg(buffer, metadata) {
    const tmp = `./tmp_${Math.random().toString(36).substring(7)}.webp`;
    const out = `./out_${Math.random().toString(36).substring(7)}.webp`;
    fs.writeFileSync(tmp, buffer);
    
    // Usamos webpmux para inyectar los datos EXIF
    return new Promise((resolve, reject) => {
        const exif = {
            "sticker-pack-id": "friends-happy-bot",
            "sticker-pack-name": metadata.packname,
            "sticker-pack-publisher": metadata.author,
        };
        const json = JSON.stringify(exif);
        const exiffile = Buffer.concat([Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]), Buffer.from(json, 'utf-8')]);
        exiffile.writeUIntLE(json.length, 14, 4);

        fs.writeFileSync('exif.json', exiffile);
        
        spawn('webpmux', ['-set', 'exif', 'exif.json', tmp, out])
        .on('exit', () => {
            const final = fs.readFileSync(out);
            fs.unlinkSync(tmp);
            fs.unlinkSync(out);
            fs.unlinkSync('exif.json');
            resolve(final);
        });
    });
}

module.exports = { writeExifImg };
