import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import PokerLab from "@/app/(poker)/PokerLab";

export const metadata: Metadata = {
  title: "Poker Equity Calculator",
  description:
    "Live Monte Carlo poker equity simulation powered by the poker-calculations C++ engine.",
};

export default function PokerLabPage() {
  return (
    <DemoPage
      back="/projects/poker-bot"
      kicker="poker-lab"
      title="Poker Equity Calculator"
      wide={false}
      lede={
        <>
          Monte Carlo simulation via the{" "}
          <LedeLink href="https://www.npmjs.com/package/poker-calculations">poker-calculations</LedeLink>{" "}
          C++ engine. Enter hole cards and an optional board to run equity.
        </>
      }
    >
      <PokerLab />
    </DemoPage>
  );
}
