// Fetch the built engine bundles the demos load at runtime, pinned by
// artifacts.lock.json, into public/wasm/. Runs before `next build` and
// `next dev` (see package.json), so a fresh clone and a Vercel build both
// get the exact bytes the lock names — and nothing else is downloaded.
//
// Why they are not in the source tree: they are build products (js_of_ocaml
// and wasm32-wasip1 output) that Vercel cannot rebuild, and a 3,000-line
// generated file makes every analysis of the *source* about the generator.
// They live on the orphan `artifacts` branch; `pnpm artifacts:push` puts a
// new build there and updates the lock.
//
//   pnpm artifacts:pull        # fetch whatever the lock names (no-op when up to date)

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "DevomB/Portfoilo-Website";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function localHash(path) {
  try {
    return sha256(await readFile(path));
  } catch {
    return null;
  }
}

async function fetchPinned(rel, pin) {
  const url = `https://raw.githubusercontent.com/${REPO}/${pin.commit}/${rel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${rel}: ${res.status} ${res.statusText} fetching ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const got = sha256(bytes);
  if (got !== pin.sha256) throw new Error(`${rel}: sha256 ${got} does not match the lock's ${pin.sha256}`);
  return bytes;
}

async function main() {
  const lock = JSON.parse(await readFile(join(ROOT, "artifacts.lock.json"), "utf8"));
  for (const [rel, pin] of Object.entries(lock.artifacts)) {
    const path = join(ROOT, rel);
    if ((await localHash(path)) === pin.sha256) {
      console.log(`artifacts: ${rel} up to date`);
      continue;
    }
    const bytes = await fetchPinned(rel, pin);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    console.log(`artifacts: ${rel} <- ${lock.branch}@${pin.commit.slice(0, 7)} (${(bytes.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(`artifacts: ${e.message}`);
  process.exit(1);
});
