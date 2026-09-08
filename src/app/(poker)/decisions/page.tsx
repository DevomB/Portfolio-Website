import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import RiverDecisions from "@/app/(poker)/RiverDecisions";

export const metadata: Metadata = {
  title: "Geometry of Decisions",
  description:
    "A river decision surface over all 169 hands: paint what you believe about your opponent, and watch fold, call and raise trade places. Every value can be checked by hand.",
};

export default function DecisionsPage() {
  return (
    <DemoPage
      back="/projects/poker-bot"
      kicker="decisions"
      title="Geometry of Decisions"
      lede={
        <>
          Heads-up on the river. The opponent has bet. The terrain is every hand you could be
          holding: its height is the value of your best action, its colour is which action that
          is. Paint what you believe about the opponent — the range they arrive with, how much of
          it they bet for value, how much they bluff, whether they fold to a raise — and the
          surface moves. Showdowns are scored by the C++ engine behind{" "}
          <LedeLink href="https://www.npmjs.com/package/poker-calculations">poker-calculations</LedeLink>
          ; the game on top is small enough that every number can be checked by hand.
        </>
      }
    >
      <RiverDecisions />
    </DemoPage>
  );
}
