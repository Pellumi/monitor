const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const desktopRoot = path.resolve(__dirname, '..');
const source = path.join(desktopRoot, 'src', 'renderer', 'logo_icon.svg');
const output = path.join(desktopRoot, 'build', 'icon.png');

async function main() {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(source)
    .resize(1024, 1024, { fit: 'contain' })
    .png()
    .toFile(output);
  console.log(`Generated ${path.relative(desktopRoot, output)} from src/renderer/logo_icon.svg`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
