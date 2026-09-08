import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import CardDesk from "@/app/card-desk/CardDesk";

export const metadata: Metadata = {
  title: "Card Sum Options Desk",
  description:
    "Options on the sum of drawn cards — theo and Greeks re-priced live by the cardquant Python package.",
};

export default function CardDeskPage() {
  return (
    <DemoPage
      back="/projects/cardquant"
      kicker="card-desk"
      title="Card Sum Options Desk"
      wide={false}
      lede={
        <>
          IMC&apos;s mock trading game as a desk. Draw cards one at a time and watch theo and
          the Greeks re-price across every strike — computed exactly by the{" "}
          <LedeLink href="https://pypi.org/project/cardquant/">cardquant</LedeLink>{" "}
          Python package, running unmodified on CPython.
        </>
      }
    >
      <CardDesk />
    </DemoPage>
  );
}
