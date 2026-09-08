import TectonixChart, { type Point } from "@/app/(home)/TectonixChart";
import bundled from "@/app/(home)/tectonixHistory.json";

/* Tectonix vs this site.
   The real `tectonix` binary (github.com/DevomB/Tectonix) scores every
   first-parent commit of this repository, and the 0–10,000 quality signal is
   charted here: the site grading its own architecture, commit by commit, with
   a tool its author wrote.

   Where the numbers come from, in order:
   1. On every push, .github/workflows/tectonix-history.yml scores the new
      commits and publishes history/<branch>.json to the `tectonix-history`
      data branch. This server component fetches that file for the branch
      this deployment was built from and revalidates it every five minutes,
      so the chart follows the repo without a bot ever committing to a code
      branch. The fetch is server-side only; visitors never contact GitHub.
   2. If that file is missing, unreachable, or shorter than what we ship
      (a partial write), the bundled snapshot — the same JSON, refreshed by
      hand with `pnpm tectonix:history` — is used instead. The page always
      renders. */

type History = { generated?: string; tool: string; branch: string; points: Point[] };

const REPO = "DevomB/Portfoilo-Website";
const DATA_BRANCH = "tectonix-history";
const REVALIDATE_SECONDS = 300;

function branchForThisDeployment(): string {
  return (
    process.env.TECTONIX_HISTORY_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    (bundled as History).branch ||
    "main"
  );
}

async function loadHistory(): Promise<{ history: History; source: "live" | "bundled" }> {
  const fallback = bundled as History;
  const branch = branchForThisDeployment();
  const url = `https://raw.githubusercontent.com/${REPO}/${DATA_BRANCH}/history/${encodeURIComponent(branch)}.json`;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return { history: fallback, source: "bundled" };
    const live = (await res.json()) as Partial<History>;
    const ok = Array.isArray(live.points) && live.points.length >= fallback.points.length && typeof live.tool === "string";
    return ok ? { history: live as History, source: "live" } : { history: fallback, source: "bundled" };
  } catch {
    return { history: fallback, source: "bundled" };
  }
}

export default async function TectonixSection() {
  const { history } = await loadHistory();
  const points = history.points.filter((p) => p.signal !== null);
  return <TectonixChart points={points} tool={history.tool} branch={history.branch} />;
}
