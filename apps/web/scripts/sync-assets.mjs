// Copies the tofu wasm build into public/tofu, gzip-compressed so it stays
// small on static hosts that do not compress application/wasm themselves.
import { createReadStream, createWriteStream, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip, constants } from "node:zlib";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../../../packages/tofu-wasm/dist/", import.meta.url));
const out = fileURLToPath(new URL("../public/tofu/", import.meta.url));
mkdirSync(out, { recursive: true });

const wasm = `${src}tofu.wasm`;
await pipeline(createReadStream(wasm), createGzip({ level: constants.Z_BEST_COMPRESSION }), createWriteStream(`${out}tofu.wasm.gz`));
for (const f of ["functions.json", "schemas.json"]) copyFileSync(src + f, out + f);
const version = JSON.parse(readFileSync(`${src}version.json`, "utf8"));
writeFileSync(
  `${out}manifest.json`,
  JSON.stringify({
    version: version.terraform_version,
    size: statSync(wasm).size,
    gzipSize: statSync(`${out}tofu.wasm.gz`).size,
    builtAt: new Date().toISOString(),
  }),
);
console.log(readFileSync(`${out}manifest.json`, "utf8"));
copyFileSync(`${src}wasm_exec.js`, fileURLToPath(new URL("../../../packages/runtime/src/wasm_exec.js", import.meta.url)));
