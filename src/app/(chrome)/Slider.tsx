import type { CSSProperties, InputHTMLAttributes } from "react";

/** A native range input, drawn like Chromium's own but in rem (see .slider in
 *  globals.css) so it scales with the page. It tells the stylesheet where the
 *  value sits (`--r`, 0..1) so the filled track can end under the thumb. */
export function Slider({ value, min, max, className = "", style, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max"> & {
  value: number;
  min: number;
  max: number;
}) {
  const r = max > min ? (value - min) / (max - min) : 0;
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      className={`slider ${className}`.trim()}
      style={{ ...style, "--r": r } as CSSProperties}
      {...rest}
    />
  );
}
