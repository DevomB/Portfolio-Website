import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import Landscape from "@/app/(poker)/Landscape";

export const metadata: Metadata = {
  title: "The Landscape",
  description:
    "All 169 starting hands as a terrain — height is equity against the range you paint, computed live by the poker-calculations engine, exact on the river. Deal a board and watch it deform.",
};

export default function LandscapePage() {
  return (
    <DemoPage
      back="/projects/poker-bot"
      kicker="landscape"
      title="The Landscape"
      lede={
        <>
          Every one of the 169 starting hands as terrain. Height is equity, computed live by
          the C++ engine behind{" "}
          <LedeLink href="https://www.npmjs.com/package/poker-calculations">poker-calculations</LedeLink>
          . Paint the range you put your opponent on and every height re-prices against it —
          sampled showdowns before the river, exact on it. Deal a board and watch the
          mountains move; switch to random opponents to see the map without a read.
        </>
      }
    >
      <Landscape />
    </DemoPage>
  );
}
