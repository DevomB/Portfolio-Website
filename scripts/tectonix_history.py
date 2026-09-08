"""Tectonix vs this site: run the real `tectonix` binary over every first-parent
commit of this repository and record the quality signal per commit.

    pnpm tectonix:history            # incremental — only commits not yet recorded
    pnpm tectonix:history -- --all   # rebuild from scratch

Writes src/app/(home)/tectonixHistory.json, which the home page charts. Each commit is
checked out into a temporary git worktree (tectonix scans via `git ls-files`, so
a plain export would not do), scanned, and health-checked; nothing is written
into this repository by tectonix itself.

Requires the tectonix binary on PATH (cargo install --git
https://github.com/DevomB/Tectonix). Grammar libraries are downloaded to
~/.tectonix on first use; later runs skip the download.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# Windows consoles default to cp1252; commit subjects here contain arrows and
# interpuncts. Never let a log line kill a ten-minute run.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover
        pass

ROOT = Path(__file__).resolve().parent.parent
# Where the history is written. Locally this is the snapshot bundled with the
# site (the chart's offline fallback); in CI the workflow points it at the
# data branch's file so scoring is incremental across runs.
OUT = Path(os.environ["TECTONIX_HISTORY_OUT"]) if os.environ.get("TECTONIX_HISTORY_OUT") else ROOT / "src" / "app" / "(home)" / "tectonixHistory.json"
TECTONIX = shutil.which("tectonix") or str(Path.home() / ".cargo" / "bin" / "tectonix.exe")


def git(*args: str, cwd: Path = ROOT) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8").stdout


def run_json(*args: str, cwd: Path) -> dict:
    env = {**os.environ, "TECTONIX_SKIP_GRAMMAR_DOWNLOAD": os.environ.get("TECTONIX_SKIP_GRAMMAR_DOWNLOAD", "0")}
    p = subprocess.run([TECTONIX, *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", env=env)
    if p.returncode != 0:
        raise RuntimeError(f"tectonix {' '.join(args)} failed: {p.stderr.strip()[:300]}")
    return json.loads(p.stdout)


def commits() -> list[dict]:
    raw = git("log", "--first-parent", "--reverse", "--format=%H%x1f%aI%x1f%s")
    out = []
    for line in raw.splitlines():
        sha, date, subject = line.split("\x1f", 2)
        out.append({"sha": sha, "date": date, "subject": subject})
    return out


def measure(sha: str) -> dict:
    wt = Path(tempfile.mkdtemp(prefix="tx-"))
    try:
        git("worktree", "add", "--detach", "--quiet", str(wt), sha)
        scan = run_json("scan", ".", cwd=wt)
        health = run_json("health", ".", cwd=wt)
        diag = health.get("diagnostics", {})
        eq, mod, acy, dep, red = (diag.get(k, {}) for k in ("equality", "modularity", "acyclicity", "depth", "redundancy"))
        return {
            "signal": health.get("quality_signal", scan.get("quality_signal")),
            "bottleneck": health.get("bottleneck"),
            "files": scan.get("files"),
            "lines": scan.get("lines"),
            "importEdges": scan.get("import_edges"),
            "crossModuleEdges": health.get("cross_module_edges"),
            "cycles": len(acy.get("cycles", [])),
            "maxDepth": dep.get("max_depth"),
            "complexFunctions": len(eq.get("complex_functions", [])),
            "longFunctions": len(eq.get("long_functions", [])),
            "godFiles": len(mod.get("god_files", [])),
            "hotspotFiles": len(mod.get("hotspot_files", [])),
            "deadFunctions": len(red.get("dead_functions", [])),
            "duplicateGroups": len(red.get("duplicate_groups", [])),
        }
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(wt)], cwd=ROOT, capture_output=True)
        shutil.rmtree(wt, ignore_errors=True)


def main() -> int:
    rebuild = "--all" in sys.argv
    previous: dict[str, dict] = {}
    if OUT.exists() and not rebuild:
        for p in json.loads(OUT.read_text(encoding="utf-8")).get("points", []):
            previous[p["sha"]] = p

    version = subprocess.run([TECTONIX, "--version"], capture_output=True, text=True).stdout.strip() or "tectonix"
    # CI checks out a detached ref; let it name the branch explicitly
    branch = os.environ.get("TECTONIX_HISTORY_BRANCH") or git("rev-parse", "--abbrev-ref", "HEAD").strip()

    def save(points: list[dict]) -> None:
        # written after EVERY commit, so a crash or Ctrl-C keeps the progress
        # and the next run picks up where this one stopped
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(
            json.dumps(
                {
                    "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "tool": version,
                    "repo": "DevomB/Portfoilo-Website",
                    "branch": branch,
                    "points": points,
                },
                indent=1,
            )
            + "\n",
            encoding="utf-8",
        )

    todo = commits()
    points: list[dict] = []
    for i, c in enumerate(todo, 1):
        if c["sha"] in previous:
            points.append(previous[c["sha"]])
            continue
        print(f"[{i}/{len(todo)}] {c['sha'][:7]} {c['subject'][:60]}", flush=True)
        try:
            m = measure(c["sha"])
        except Exception as exc:  # keep going; a bad commit becomes a gap, not a crash
            print(f"    ! {exc}", file=sys.stderr, flush=True)
            m = {"signal": None, "bottleneck": None}
        points.append({"sha": c["sha"], "short": c["sha"][:7], "date": c["date"], "subject": c["subject"], **m})
        print(f"    signal {m.get('signal')}  bottleneck {m.get('bottleneck')}", flush=True)
        save(points)

    save(points)
    print(f"wrote {OUT.relative_to(ROOT)} — {len(points)} commits", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
