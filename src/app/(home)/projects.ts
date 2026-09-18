export type ReadmeSection = {
  title: string;
  body: string;
};

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  techStack: string[];
  githubUrl?: string;
  npmPackage?: string;
  /** PyPI distribution name, e.g. "cardquant" — renders a pip snippet. */
  pypiPackage?: string;
  /** crates.io crate name, e.g. "athenas-pallas". */
  crate?: string;
  /** Route of the live, in-site demo for this project, e.g. "/poker-lab". */
  demoPath?: string;
  /** Further in-site demos for the same project, shown beside the main one. */
  extraDemos?: { label: string; path: string }[];
  liveUrl?: string;
  readmeSections?: ReadmeSection[];
};

export const projects: Project[] = [
  {
    slug: "poker-calculations",
    name: "Poker Calculations",
    tagline: "NL Hold'em toolkit for Node.js on a C++20 core — hands, equity, pot and chip math, ICM.",
    description:
      "An npm package for no-limit Hold'em math: hand evaluation, Monte Carlo and exact equity, pot odds and chip EV, ICM and side pots, draw probabilities, fold equity and GTO-style frequencies, and a rule-based decideAction layer over serialized table state. The core is C++20, exposed to Node through N-API with prebuilt binaries for Linux, macOS and Windows — npm install needs no compiler — and it ships full TypeScript types. The three poker demos on this site call the published package from their API routes.",
    techStack: ["C++20", "CMake", "N-API", "Node.js", "npm"],
    githubUrl: "https://github.com/DevomB/Poker-Calculations",
    npmPackage: "poker-calculations",
    demoPath: "/poker-lab",
    extraDemos: [
      { label: "The Landscape", path: "/landscape" },
      { label: "Geometry of Decisions", path: "/decisions" },
    ],
    readmeSections: [
      {
        title: "Architecture",
        body: "The C++20 core is a set of small modules: cards as a rank byte and a suit byte, with packed 0–51 deck ids for hot paths; a deck shuffled by a seeded Mersenne Twister; a game state that walks pre-flop → flop → turn → river → showdown; a best-five hand evaluator that packs a hand's category and kickers into one comparable 64-bit strength; and the equity code on top of it — Monte Carlo, exact heads-up, and range against range. The N-API layer exposes it all to Node, synchronously or on the libuv thread pool with optional cancellation.",
      },
      {
        title: "How the equity simulation works",
        body: "Given hero hole cards and an optional partial board, each iteration shuffles the cards still in the deck, deals the villains and the rest of the board, and scores the showdown; a tie splits the pot among the tied hands. The parallel runner splits the iterations into one chunk per thread, gives each chunk its own seeded generator, and averages the chunks' equities weighted by their size, so a seed reproduces its answer. The poker-calculations npm package wraps this engine via N-API so it can run inside a Next.js API route.",
      },
      {
        title: "How it ships",
        body: "Releases publish N-API prebuilds for Linux (glibc and musl), macOS and Windows, so installing the package never compiles C++. CI stages each binary and loads it exactly as an installed package does, exercising a few calls — on every prebuild, and again on the assembled package before it is published.",
      },
    ],
  },
  {
    slug: "cardquant",
    name: "CardQuant",
    tagline: "Options on the sum of drawn cards — theo and Greeks, priced exactly, live.",
    description:
      "A Python library for the trading-firm mock games: IMC's card-sum options and Jane Street's Figgie. CardValuation prices European calls and puts on the sum of n cards drawn from a deck by exact combinatorial enumeration — no Monte Carlo — and reports Delta, Gamma, and the 'one more card' time Greeks: Theta, Charm and Color. The desk on this site runs the published package, unmodified, on CPython.",
    techStack: ["Python", "NumPy", "Combinatorics", "PyPI", "Vercel Functions"],
    githubUrl: "https://github.com/DevomB/cardquant",
    pypiPackage: "cardquant",
    demoPath: "/card-desk",
    readmeSections: [
      {
        title: "How the pricing works",
        body: "The final sum of n cards is a discrete distribution, and for a deck without replacement it is fully enumerable: a dynamic program over rank counts builds the number of ways every partial sum can occur, weighted by binomial coefficients. Theo is the expectation of max(S − K, 0) — or max(K − S, 0) for a put — over that distribution. Every number the desk shows is exact, not sampled.",
      },
      {
        title: "The Greeks, on a deck",
        body: "Delta is the probability the option expires in the money. Gamma is the change in Delta across one strike. The time Greeks are defined by the only clock a card game has — the next draw: Theta, Charm and Color are the change in Theo, Delta and Gamma when one more card, the expected one, is drawn. Seeing a card re-prices everything, which is exactly what the desk lets you watch.",
      },
      {
        title: "Why it runs as Python",
        body: "The desk does not port the math. It calls the published cardquant package on real CPython behind a serverless function, and because every price is a pure function of the cards seen, the results are cached at the edge — a state anyone has priced before is served without running Python again.",
      },
    ],
  },
  {
    slug: "athenas-pallas",
    name: "Athena's Pallas",
    tagline: "Event-driven backtesting engine in Rust — deterministic replay, honest fills, on crates.io.",
    description:
      "An event-driven algorithmic backtesting framework: a replay engine over bars or tick data, paper execution with queue-aware fills, order types with real time-in-force semantics, a risk engine, options analytics, and a report that records everything from fees and turnover to rejections. Strategies plug in through a Rust trait or run as external Python/C++ processes over a JSON protocol. Published as athenas-pallas on crates.io. The Mirage and the Adversarial Tape on this site are the published crate compiled for the browser: the same code, a different CPU.",
    techStack: ["Rust", "Event-driven", "Backtesting", "WASI", "crates.io"],
    githubUrl: "https://github.com/DevomB/Athenas-Pallas",
    crate: "athenas-pallas",
    demoPath: "/mirage",
    extraDemos: [{ label: "Adversarial Tape", path: "/adversarial" }],
    readmeSections: [
      {
        title: "Why a backtest lies",
        body: "Sweep a parameter grid over a year of prices and something always looks good — the best of sixty-four tries is not a strategy, it is an order statistic. The Mirage runs the experiment honestly: the engine backtests every cell in-sample, three procedures pick a strategy (the in-sample peak, the plateau around it, a walk-forward that re-picks each quarter), and a held-out year grades them. Then the in-sample returns are shuffled and the whole sweep re-run, so the peak can be compared with what luck alone produces. Plant a signal in the world or leave it as noise, and watch which procedure is fooled.",
      },
      {
        title: "Why attack a backtest",
        body: "A backtest is one path through history. A strategy that only works on that path was never a strategy; it was a coincidence. The Adversarial Tape turns the engine on its own users: it searches for the price path that makes a given strategy lose the most, with the first and last close pinned so the attacker can only reorder time, never crash the market. What survives that is a strategy. What doesn't was path risk.",
      },
      {
        title: "What the engine does per bar",
        body: "Each bar becomes a market event; strategies see read-only state (last price, positions, equity) and emit order intents. Paper execution fills them with fees, slippage, half-spread, participation limits and optional latency, then the risk engine checks position limits, daily loss and margin. Equity is marked to market every bar and the report carries P&L, drawdown, Sharpe, Sortino, fill counts, win rate, turnover, and every rejection with its reason.",
      },
      {
        title: "Running it in a browser",
        body: "The engine reads its tape from a file, so in the browser it gets one: a WASI build with an in-memory filesystem holding /tape.csv. The site writes a candidate tape, the engine's own CSV loader parses it, its own runner replays it, and its own report comes back as JSON. Three textbook strategies (SMA crossover, momentum, mean reversion) are written against the engine's Strategy trait — its documented extension point. Around 340 full backtests per second on a laptop, in one tab.",
      },
    ],
  },
  {
    slug: "ananke",
    name: "Ananke",
    tagline: "Typed deterministic event runtime in OCaml — replay, snapshots, structural diffs, invariant checks.",
    description:
      "A laboratory for stateful systems. A domain declares its state, commands, events, a pure transition function and named invariants; the runtime records every command, emitted event and invariant outcome in a replayable trace, snapshots state on demand, diffs states structurally, verifies that a replay is identical, shrinks a failing command sequence to a minimal reproduction and forks alternate futures from a checkpoint. Randomness is explicit — domains draw from an RNG the runtime threads through, never an ambient generator. The Counterexample on this site is Ananke compiled from OCaml to JavaScript and run unmodified in the browser.",
    techStack: ["OCaml 5", "dune", "Base", "js_of_ocaml", "property testing"],
    githubUrl: "https://github.com/DevomB/Ananke",
    demoPath: "/counterexample",
    readmeSections: [
      {
        title: "What a trace is",
        body: "Every run is a sequence of events: the command as submitted, each event the domain emitted, the outcome of every named invariant, the clock advancing, and, when asked, a snapshot of the whole state. The trace is data. It can be replayed on a fresh runtime and compared event by event, and the first divergence is reported with a structural diff of the states.",
      },
      {
        title: "Shrinking a failure",
        body: "Given a command sequence that fails and a predicate for what failing means, the minimizer drops commands — half the list at a time, then one at a time — replaying the runtime on each candidate, until nothing more can go. The Counterexample uses it on a forty-command payment scenario and comes back with the handful that reproduce the bug.",
      },
      {
        title: "Branching",
        body: "Run a prefix, snapshot, then apply two different suffixes from the same checkpoint and diff the two final states. It answers the question a bug report never can: what would have happened if the next command had been different.",
      },
      {
        title: "Why it runs as OCaml",
        body: "The runtime is not ported. js_of_ocaml compiles the same OCaml bytecode to JavaScript; the payments domain on this site is written against Ananke's Domain.S signature — its documented extension point — and a thin bridge calls Runtime, Replay, Minimize and Branch exactly as the CLI does, answering in JSON.",
      },
    ],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
