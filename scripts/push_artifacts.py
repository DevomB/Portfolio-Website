"""Publish the built engine bundles to the orphan `artifacts` branch and pin
them in artifacts.lock.json.

    pnpm js:ananke        # or pnpm wasm:pallas — writes public/wasm/...
    pnpm artifacts:push   # commits those bytes to `artifacts`, pushes, updates the lock
    git commit artifacts.lock.json

The lock names the branch commit and the sha256 of every artifact;
scripts/fetch_artifacts.mjs downloads exactly that before every build. The
files themselves are not tracked on code branches: they are build products
(js_of_ocaml and wasm32-wasip1 output), not source.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCK = ROOT / "artifacts.lock.json"
BRANCH = "artifacts"
ARTIFACTS = [
    "public/wasm/ananke-counterexample.js",
    "public/wasm/pallas-arena.wasm",
]


def git(*args: str, cwd: Path = ROOT) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8").stdout.strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def branch_exists() -> bool:
    return subprocess.run(["git", "ls-remote", "--exit-code", "--heads", "origin", BRANCH], cwd=ROOT, capture_output=True).returncode == 0


def main() -> int:
    missing = [a for a in ARTIFACTS if not (ROOT / a).exists()]
    if missing:
        print("not built yet: " + ", ".join(missing) + "  (pnpm js:ananke / pnpm wasm:pallas)", file=sys.stderr)
        return 1

    wt = Path(tempfile.mkdtemp(prefix="artifacts-"))
    try:
        if branch_exists():
            git("fetch", "--quiet", "origin", BRANCH)
            git("worktree", "add", "--quiet", str(wt), f"origin/{BRANCH}")
            git("checkout", "-q", "-B", BRANCH, cwd=wt)
        else:
            git("worktree", "add", "--quiet", "--detach", str(wt))
            git("checkout", "-q", "--orphan", BRANCH, cwd=wt)
            subprocess.run(["git", "rm", "-rfq", "."], cwd=wt, capture_output=True)
            for stray in wt.iterdir():
                if stray.name != ".git":
                    shutil.rmtree(stray) if stray.is_dir() else stray.unlink()

        for rel in ARTIFACTS:
            dest = wt / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / rel, dest)
        (wt / "README.md").write_text(
            "# artifacts\n\nBuilt engine bundles for devomb.com, published by scripts/push_artifacts.py and "
            "fetched by scripts/fetch_artifacts.mjs at build time. Not source: see the wasm/ directory on the code branches.\n",
            encoding="utf-8",
        )
        (wt / "vercel.json").write_text('{ "git": { "deploymentEnabled": false } }\n', encoding="utf-8")
        git("add", "-A", cwd=wt)
        if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=wt).returncode == 0:
            commit = git("rev-parse", "HEAD", cwd=wt)
            print(f"nothing new on {BRANCH}; lock stays at {commit[:7]}")
        else:
            names = ", ".join(Path(a).name for a in ARTIFACTS)
            git("-c", "user.name=artifacts", "-c", "user.email=artifacts@users.noreply.github.com", "commit", "-q", "-m", f"artifacts: {names}", cwd=wt)
            git("push", "-q", "origin", f"HEAD:{BRANCH}", cwd=wt)
            commit = git("rev-parse", "HEAD", cwd=wt)
            print(f"pushed {BRANCH} @ {commit[:7]}")
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(wt)], cwd=ROOT, capture_output=True)
        shutil.rmtree(wt, ignore_errors=True)

    lock = {
        "repo": "DevomB/Portfoilo-Website",
        "branch": BRANCH,
        "artifacts": {rel: {"commit": commit, "sha256": sha256(ROOT / rel)} for rel in ARTIFACTS},
    }
    LOCK.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {LOCK.name}; commit it with the code that needs these builds")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
