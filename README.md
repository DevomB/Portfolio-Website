# DB-Portfolio

Personal site for Devom Brahmbhatt: Next.js (App Router), Tailwind CSS, and a set of in-browser demos backed by real engines — the poker-calculations C++ addon, Athena's Pallas in WASI, Ananke compiled from OCaml.

## Commands

```bash
pnpm install
pnpm dev          # fetches the engine builds (see below), then next dev
pnpm build        # same fetch, then next build; pnpm start serves it
pnpm test         # vitest over the pure modules
pnpm lint
```

Open [http://localhost:3000](http://localhost:3000).

### Engine builds

The demos load two built bundles at runtime — `public/wasm/pallas-arena.wasm` (Rust → wasm32-wasip1) and `public/wasm/ananke-counterexample.js` (OCaml → js_of_ocaml). They are build products, not source, so they are not tracked here: they live on the orphan `artifacts` branch, pinned by commit and sha256 in `artifacts.lock.json`, and `scripts/fetch_artifacts.mjs` downloads exactly those bytes before every dev server and build (a no-op when the local copy already matches).

```bash
pnpm wasm:pallas      # rebuild the Pallas arena (needs rustup target wasm32-wasip1)
pnpm js:ananke        # rebuild the Ananke bridge (WSL, opam switch `ananke`)
pnpm artifacts:push   # publish what is in public/wasm to `artifacts`, rewrite the lock
git commit artifacts.lock.json
pnpm artifacts:pull   # fetch whatever the lock names
```

### Tectonix

The home page charts the Tectonix quality signal of every commit. CI scores each push (`.github/workflows/tectonix-history.yml`) and publishes the result to the `tectonix-history` data branch; the page reads that file server-side and falls back to the bundled snapshot.

```bash
pnpm tectonix:pull      # refresh src/app/(home)/tectonixHistory.json from the data branch
pnpm tectonix:history   # score commits locally into .tectonix/history-local.json (an experiment file)
pnpm tectonix:rules     # check .tectonix/rules.toml — CI runs this on every push
```

Requires the `tectonix` binary (`cargo install --git https://github.com/DevomB/Tectonix`). On Linux, build its grammars first with `bash scripts/tectonix_grammars.sh`.

## Environment

Optional: `NEXT_PUBLIC_SITE_URL` — canonical URL for metadata and link-preview images. Defaults to `https://devomb.com` when unset.
