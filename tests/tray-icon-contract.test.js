import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "desktop", "src", "assets");

function analyzePng(filePath) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  let transparent = 0;
  let nonTransparent = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha === 0) {
        transparent++;
      } else {
        nonTransparent++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    width: png.width,
    height: png.height,
    transparent,
    nonTransparent,
    bounds: { minX, minY, maxX, maxY },
  };
}

describe("macOS tray icon contract", () => {
  it("keeps template tray icons transparent instead of full-rectangle images", () => {
    const icons = [
      { name: "tray-template.png", size: 16 },
      { name: "tray-template@2x.png", size: 32 },
      { name: "tray-dev-template.png", size: 16 },
      { name: "tray-dev-template@2x.png", size: 32 },
    ];

    for (const icon of icons) {
      const stats = analyzePng(path.join(ASSETS_DIR, icon.name));
      const totalPixels = icon.size * icon.size;

      expect(stats.width).toBe(icon.size);
      expect(stats.height).toBe(icon.size);
      expect(stats.transparent).toBeGreaterThan(totalPixels * 0.35);
      expect(stats.nonTransparent).toBeLessThan(totalPixels * 0.65);
      expect(stats.bounds.minX).toBeGreaterThanOrEqual(Math.floor(icon.size * 0.15));
      expect(stats.bounds.maxX).toBeLessThanOrEqual(Math.ceil(icon.size * 0.85));
    }
  });

  it("uses macOS template rendering for tray assets", () => {
    const main = fs.readFileSync(path.join(ROOT, "desktop", "main.cjs"), "utf-8");

    expect(main).toContain('"tray-template.png"');
    expect(main).toContain("icon.setTemplateImage(true)");
  });
});
