/** Box–Muller: one standard normal draw from a uniform PRNG. Shared by the
    tapes (geometric Brownian motion) and the worlds (AR(1) returns). */
export function normal(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
