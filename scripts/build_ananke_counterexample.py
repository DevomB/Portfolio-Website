"""Build the Counterexample bridge: Ananke (OCaml, pinned from GitHub) plus the
payments domain, compiled to JavaScript by js_of_ocaml and copied to
public/wasm/ananke-counterexample.js. Vercel has no OCaml toolchain, so the
build is published to the `artifacts` branch and fetched at build time:

    pnpm js:ananke
    pnpm artifacts:push   # then commit artifacts.lock.json

Runs inside WSL, where the opam switch `ananke` holds OCaml 5.2, dune,
js_of_ocaml and the pinned `ananke` package:

    opam pin add -y ananke https://github.com/DevomB/Ananke.git
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRATE = ROOT / "wasm" / "ananke-counterexample"
OUT = ROOT / "public" / "wasm" / "ananke-counterexample.js"


def wsl_path(p: Path) -> str:
    s = str(p.resolve()).replace("\\", "/")
    return "/mnt/" + s[0].lower() + s[2:]


def main() -> int:
    src = wsl_path(CRATE)
    # build on the Linux filesystem (dune on DrvFS is slow), then copy back
    script = (
        "set -e; export PATH=$HOME/.local/bin:$PATH; eval \"$(opam env --switch=ananke --set-switch)\"; "
        f"rm -rf ~/ananke-cx && mkdir -p ~/ananke-cx && cp {src}/dune-project {src}/dune {src}/*.ml ~/ananke-cx/ && cd ~/ananke-cx && "
        "dune build ./counterexample.bc.js --profile release 2>&1 && "
        # dune's artifacts are read-only; DrvFS keeps that bit, so replace rather than overwrite
        f"rm -f {wsl_path(OUT)} && cp _build/default/counterexample.bc.js {wsl_path(OUT)} && chmod 644 {wsl_path(OUT)} && ls -l {wsl_path(OUT)}"
    )
    print("wsl: dune build (wasm/ananke-counterexample -> public/wasm/ananke-counterexample.js)", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["wsl.exe", "-e", "bash", "-lc", script])
    if r.returncode != 0:
        return r.returncode
    print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
