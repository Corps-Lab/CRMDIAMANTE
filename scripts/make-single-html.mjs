import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");
const inputPath = path.join(distDir, "index.html");
const outputPath = path.join(distDir, "index.single.html");

if (!fs.existsSync(inputPath)) {
  console.error("dist/index.html not found. Run build first.");
  process.exit(1);
}

const mimeByExt = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const toDataUrl = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeByExt[ext] || "application/octet-stream";
  const raw = fs.readFileSync(filePath);
  return `data:${mime};base64,${raw.toString("base64")}`;
};

let html = fs.readFileSync(inputPath, "utf8");

// Inline generated CSS files.
html = html.replace(
  /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_match, href) => {
    const cssPath = path.resolve(distDir, href);
    if (!fs.existsSync(cssPath)) return "";
    const css = fs.readFileSync(cssPath, "utf8");
    return `<style>\n${css}\n</style>`;
  }
);

// Inline generated JS bundles.
html = html.replace(
  /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_match, src) => {
    const jsPath = path.resolve(distDir, src);
    if (!fs.existsSync(jsPath)) return "";
    let js = fs.readFileSync(jsPath, "utf8");

    // When JS is inlined, import.meta.url points to index.single.html (not /assets).
    // Convert bundled asset URLs to data URLs so the file is fully portable.
    js = js.replace(
      /new URL\("([A-Za-z0-9._-]+)",\s*import\.meta\.url\)/g,
      (_m, fileName) => {
        const assetPath = path.resolve(distDir, "assets", fileName);
        if (!fs.existsSync(assetPath)) {
          return `new URL("./assets/${fileName}", import.meta.url)`;
        }
        return `new URL("${toDataUrl(assetPath)}")`;
      }
    );

    js = js.replace(
      /new URL\("\.\/assets\/([^"]+)",\s*import\.meta\.url\)/g,
      (_m, fileName) => {
        const assetPath = path.resolve(distDir, "assets", fileName);
        if (!fs.existsSync(assetPath)) {
          return `new URL("./assets/${fileName}", import.meta.url)`;
        }
        return `new URL("${toDataUrl(assetPath)}")`;
      }
    );

    return `<script type="module">\n${js}\n</script>`;
  }
);

// Service worker and manifest are not needed for local single-file checks.
html = html.replace(/<link\s+rel="manifest"[^>]*>\n?/g, "");

fs.writeFileSync(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);
