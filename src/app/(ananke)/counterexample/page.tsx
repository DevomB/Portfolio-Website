import type { Metadata } from "next";
import DemoPage, { LedeLink } from "@/app/(chrome)/DemoPage";
import Counterexample from "@/app/(ananke)/Counterexample";

export const metadata: Metadata = {
  title: "Counterexample",
  description:
    "Ananke, running in your browser, records a payment workflow until an invariant breaks, replays it deterministically, shrinks the failing scenario to a minimal repro, and forks a different future from the step before.",
};

export default function CounterexamplePage() {
  return (
    <DemoPage
      back="/projects/ananke"
      kicker="counterexample"
      title="Counterexample"
      lede={
        <>
          A payment system with a bug in it. Authorizations, partial captures, refunds, voids and
          redelivered commands run through{" "}
          <LedeLink href="https://github.com/DevomB/Ananke">Ananke</LedeLink>
          , the deterministic event runtime, compiled from OCaml to run in this tab. Every command,
          event and invariant check lands in a trace; the run stops the moment an invariant breaks.
          Then the runtime does what a debugger should: replays the trace and proves it identical,
          shrinks forty commands to the handful that reproduce the bug, and forks the world at the
          step before to show the future that would have been fine.
        </>
      }
    >
      <Counterexample />
    </DemoPage>
  );
}
