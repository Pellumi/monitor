const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const desktopRoot = path.resolve(__dirname, '..');
const buildDir = path.join(desktopRoot, 'build');
const ICO_SIZES = [16, 24, 32, 48, 64, 256];

// White strokes suit a dark taskbar; black strokes suit a light one. The
// unsuffixed files stay the dark-surface mark so electron-builder keeps using it.
const VARIANTS = [
  { source: 'logo_icon.svg', png: 'icon.png', ico: 'icon.ico' },
  { source: 'logo_icon_light.svg', png: 'icon-light.png', ico: 'icon-light.ico' },
];

/**
 * Windows reads taskbar and relaunch icons from .ico files. Each size is stored
 * as an embedded PNG, which Windows Vista and later support.
 */
async function writeIco(source, output) {
  const images = await Promise.all(ICO_SIZES.map((size) =>
    sharp(source).resize(size, size, { fit: 'contain' }).png().toBuffer()));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach((image, index) => {
    const size = ICO_SIZES[index];
    const entry = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2);
    directory.writeUInt8(0, entry + 3);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.writeFile(output, Buffer.concat([header, directory, ...images]));
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  for (const variant of VARIANTS) {
    const source = path.join(desktopRoot, 'src', 'renderer', variant.source);
    await sharp(source)
      .resize(1024, 1024, { fit: 'contain' })
      .png()
      .toFile(path.join(buildDir, variant.png));
    await writeIco(source, path.join(buildDir, variant.ico));
    console.log(`Generated build/${variant.png} and build/${variant.ico} from src/renderer/${variant.source}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
