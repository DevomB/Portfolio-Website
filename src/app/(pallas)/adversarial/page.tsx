import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import AdversarialTape from "@/app/(pallas)/AdversarialTape";

export const metadata: Metadata = {
  title: "Adversarial Tape",
  description:
    "Athena's Pallas, running in your browser, hunts for the price path that makes a strategy lose the most — endpoints pinned, so it can only reorder time.",
};

export default function AdversarialPage() {
  return (
    <DemoPage
      back="/projects/athenas-pallas"
      kicker="adversarial-tape"
      title="Adversarial Tape"
      lede={
        <>
          A backtest is something to attack, not admire. Pick a textbook strategy and the
          engine —{" "}
          <LedeLink href="https://crates.io/crates/athenas-pallas">Athena&apos;s Pallas</LedeLink>
          , compiled for your browser and running in this tab — searches for the price path
          that makes it lose the most. The first and last close are pinned: it cannot crash
          the market, only reorder time. What survives that is real. What doesn&apos;t was
          path risk all along.
        </>
      }
    >
      <AdversarialTape />
    </DemoPage>
  );
}
