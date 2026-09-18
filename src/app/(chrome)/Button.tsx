import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import IntentLink from "@/app/(chrome)/IntentLink";

/* The site's two buttons, defined once. Primary: accent fill, white text,
   accent-dim on hover — never dark text on purple (3.0:1). Ghost: surface,
   hairline border, ink text; hover tints it purple. The hero, the project
   pages, the 404 and the demos all draw from here instead of carrying their
   own copy of the same long className. */

export type ButtonVariant = "primary" | "ghost";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent font-semibold text-white hover:bg-accent-dim",
  ghost: "border border-border bg-surface font-medium text-ink hover:border-accent/40 hover:bg-accent-bg hover:text-accent-dim",
};

const SIZE: Record<ButtonSize, string> = {
  md: "gap-2 px-4 py-2 text-fluid-sm",
  sm: "gap-1.5 px-3 py-1.5 text-fluid-xs",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `inline-flex items-center justify-center rounded-lg font-display transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZE[size]} ${VARIANT[variant]} ${extra}`.trim();
}

type Style = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className = "", type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & Style) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

/** A link dressed as a button. An absolute URL leaves the site in a new tab;
 *  an internal route prefetches the Next way on viewport, or on intent for the
 *  secondary and heavy routes (see IntentLink). */
export function ButtonLink({
  href,
  variant,
  size,
  className = "",
  prefetch = "viewport",
  children,
}: Style & { href: string; className?: string; prefetch?: "viewport" | "intent"; children: ReactNode }) {
  const cls = buttonClass(variant, size, className);
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return prefetch === "intent" ? (
    <IntentLink href={href} className={cls}>{children}</IntentLink>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}
