import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import Mirage from "@/app/(pallas)/Mirage";

export const metadata: Metadata = {
  title: "The Mirage",
  description:
    "A backtest-overfitting experiment: Athena's Pallas sweeps a parameter grid in your browser, three procedures pick a strategy, and a held-out year says which one was a mirage.",
};

export default function MiragePage() {
  return (
    <DemoPage
      back="/projects/athenas-pallas"
      kicker="mirage"
      title="The Mirage"
      lede={
        <>
          Sweep a parameter grid over a year of prices and something always looks good. The
          question is whether it was there. This runs the experiment:{" "}
          <LedeLink href="https://crates.io/crates/athenas-pallas">Athena&apos;s Pallas</LedeLink>
          , compiled for your browser, backtests every cell of the grid in-sample, then three
          procedures each pick a strategy — the in-sample peak, the plateau around it, and a
          walk-forward that re-picks every quarter — and a held-out year they never saw grades
          them. A shuffled-world test says how often luck alone produces the peak. Plant a
          signal in the world, or leave it as noise, and watch which procedure is fooled.
        </>
      }
    >
      <Mirage />
    </DemoPage>
  );
}
