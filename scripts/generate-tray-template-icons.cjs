#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "desktop", "src", "assets");
const TARGETS = [
  { name: "tray-template.png", size: 16 },
  { name: "tray-template@2x.png", size: 32 },
  { name: "tray-dev-template.png", size: 16 },
  { name: "tray-dev-template@2x.png", size: 32 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signedRoundedRectDistance(px, py, x, y, width, height, radius) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const qx = Math.abs(px - centerX) - (width / 2 - radius);
  const qy = Math.abs(py - centerY) - (height / 2 - radius);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outside = Math.hypot(outsideX, outsideY);
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function roundedRectCoverage(px, py, rect) {
  return clamp(0.5 - signedRoundedRectDistance(
    px,
    py,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    rect.radius,
  ), 0, 1);
}

function coverageAt(px, py) {
  const parts = [
    { x: 3.1, y: 2.6, width: 3.0, height: 10.8, radius: 1.1 },
    { x: 9.9, y: 2.6, width: 3.0, height: 10.8, radius: 1.1 },
    { x: 5.0, y: 6.7, width: 6.0, height: 2.6, radius: 0.95 },
  ];

  return clamp(parts.reduce((alpha, rect) => {
    const coverage = roundedRectCoverage(px, py, rect);
    return alpha + coverage * (1 - alpha);
  }, 0), 0, 1);
}

function renderTemplate(size) {
  const png = new PNG({ width: size, height: size, colorType: 6 });
  const samples = 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = ((x + (sx + 0.5) / samples) / size) * 16;
          const py = ((y + (sy + 0.5) / samples) / size) * 16;
          alpha += coverageAt(px, py);
        }
      }
      alpha /= samples * samples;

      const index = (y * size + x) * 4;
      png.data[index] = 0;
      png.data[index + 1] = 0;
      png.data[index + 2] = 0;
      png.data[index + 3] = Math.round(alpha * 255);
    }
  }

  return PNG.sync.write(png, { colorType: 6 });
}

function main() {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  for (const target of TARGETS) {
    const outputPath = path.join(ASSETS_DIR, target.name);
    fs.writeFileSync(outputPath, renderTemplate(target.size));
    console.log(`Generated ${path.relative(ROOT, outputPath)}`);
  }
}

main();
