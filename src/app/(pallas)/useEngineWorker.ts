"use client";

import { useEffect, useRef } from "react";

/* The engine (Athena's Pallas in WASI) runs in a Web Worker so the page stays
   responsive. Both demos drive it the same way: create the worker on the
   first run, listen for its messages, tell it to stop, terminate it with the
   component. `create` must contain the literal
   `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })`
   so the bundler can see the worker entry. */
export function useEngineWorker<Message>(create: () => Worker) {
  const ref = useRef<Worker | null>(null);
  useEffect(() => () => ref.current?.terminate(), []);

  const start = (message: unknown, onMessage: (m: Message) => void) => {
    if (!ref.current) ref.current = create();
    ref.current.onmessage = (ev: MessageEvent<Message>) => onMessage(ev.data);
    ref.current.postMessage(message);
  };
  const stop = () => ref.current?.postMessage({ type: "stop" });

  return { start, stop };
}
