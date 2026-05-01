#!/usr/bin/env bun
import { $ } from "bun";
import fs from "node:fs";
import path from "node:path";

const DIST = path.join(import.meta.dirname, "..", "dist");
const ENTRY = path.join(import.meta.dirname, "..", "index.ts");

// Build with bun, targeting Node.js
await $`bun build ${ENTRY} --outdir ${DIST} --target node --external sharp --external @resvg/resvg-js --external satori --external @fal-ai/client --external replicate`;

// Replace bun shebang with node shebang
const outFile = path.join(DIST, "index.js");
const content = fs.readFileSync(outFile, "utf-8");
const withNodeShebang = content.replace(/^#!.*\n/, "#!/usr/bin/env node\n");
fs.writeFileSync(outFile, withNodeShebang);
fs.chmodSync(outFile, 0o755);

console.log("Build complete: dist/index.js");
