"""Refresh the bundled Tectonix snapshot from the data branch.

    pnpm tectonix:pull             # history/<current branch>.json
    pnpm tectonix:pull -- main     # a named branch's file

src/app/(home)/tectonixHistory.json is the home page's offline fallback for the
chart; CI (.github/workflows/tectonix-history.yml) scores every push and
publishes the real file to the `tectonix-history` branch. This copies that
file down over git — always fresh, no CDN cache, no API limits — so the
fallback is the same reading the live page shows.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "app" / "(home)" / "tectonixHistory.json"
DATA_BRANCH = "tectonix-history"


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8").stdout


def main() -> int:
    branch = next((a for a in sys.argv[1:] if not a.startswith("-")), None) or git("rev-parse", "--abbrev-ref", "HEAD").strip()
    git("fetch", "--quiet", "origin", DATA_BRANCH)
    try:
        raw = git("show", f"origin/{DATA_BRANCH}:history/{branch}.json")
    except subprocess.CalledProcessError:
        print(f"no history/{branch}.json on {DATA_BRANCH} yet — push {branch} and let the workflow score it", file=sys.stderr)
        return 1
    data = json.loads(raw)
    points = [p for p in data["points"] if p.get("signal") is not None]
    if not points:
        print("the data branch file has no scored points; refusing to overwrite the snapshot", file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    last = points[-1]
    print(f"{OUT.relative_to(ROOT)} <- {DATA_BRANCH}:history/{branch}.json  ({len(data['points'])} commits, latest {last['short']} -> {last['signal']}, {data.get('tool')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
