"""Build the Adversarial Tape engine: the published athenas-pallas crate behind a
thin WASI wrapper (wasm/pallas-arena), compiled to wasm32-wasip1 and copied to
public/wasm/pallas-arena.wasm. Vercel has no Rust toolchain, so the build is
published to the `artifacts` branch and fetched at build time:

    pnpm wasm:pallas
    pnpm artifacts:push   # then commit artifacts.lock.json

Requires: rustup target add wasm32-wasip1
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRATE = ROOT / "wasm" / "pallas-arena"
OUT = ROOT / "public" / "wasm" / "pallas-arena.wasm"
TARGET = "wasm32-wasip1"

env = dict(os.environ)
cargo_bin = Path.home() / ".cargo" / "bin"
env["PATH"] = str(cargo_bin) + os.pathsep + env.get("PATH", "")

print(f"cargo build --release --target {TARGET}  ({CRATE.relative_to(ROOT)})", flush=True)
r = subprocess.run(["cargo", "build", "--release", "--target", TARGET], cwd=CRATE, env=env)
if r.returncode != 0:
    sys.exit(r.returncode)

built = CRATE / "target" / TARGET / "release" / "pallas_arena.wasm"
OUT.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(built, OUT)
print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB", flush=True)
