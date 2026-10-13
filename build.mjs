// Bundles the TypeScript entry points and copies static files into dist/,
// which is the folder you load as an unpacked extension.
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const OUT_DIR = "dist";

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(`${OUT_DIR}/popup`, { recursive: true });

await build({
  entryPoints: {
    background: "src/background.ts",
    "popup/popup": "src/popup/popup.ts",
  },
  outdir: OUT_DIR,
  bundle: true,
  // IIFE needs no module support from either browser's background context.
  format: "iife",
  target: ["chrome121", "firefox140"],
  logLevel: "info",
});

await cp("src/manifest.json", `${OUT_DIR}/manifest.json`);
await cp("src/popup/popup.html", `${OUT_DIR}/popup/popup.html`);
await cp("src/popup/popup.css", `${OUT_DIR}/popup/popup.css`);
await cp("icons", `${OUT_DIR}/icons`, { recursive: true });
