import type { Metadata } from "next";
import { pageMetadata } from "@/app/(chrome)/pageMetadata";
import type { ReactNode } from "react";
import LegalPage, {
  LegalLink,
  LegalSection,
  LegalSummary,
} from "@/app/(legal)/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How devomb.com handles visitor data: no accounts, no cookies, no database, nothing you type is stored.",
  path: "/privacy",
});

const Mono = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-fluid-sm text-ink">{children}</span>
);

/* The policy is content, not component logic: each section is a heading and
   its prose, and the page just lays them out in order. */
const SECTIONS: { heading: string; body: ReactNode }[] = [
  {
    heading: "What this site never does",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>No sign-ups, logins, or user accounts of any kind.</li>
        <li>No cookies are set by this site, and no cookie banner is needed.</li>
        <li>No advertising, no ad networks, no cross-site tracking, no fingerprinting.</li>
        <li>No contact form, no newsletter, no mailing list.</li>
        <li>No database — there is nowhere for your data to be stored.</li>
        <li>Nothing is ever sold, rented, or shared with anyone.</li>
      </ul>
    ),
  },
  {
    heading: "Analytics: one anonymous number",
    body: (
      <>
        <p>
          The site uses{" "}
          <LegalLink href="https://vercel.com/docs/analytics/privacy-policy">
            Vercel Web Analytics
          </LegalLink>{" "}
          to count page views. It is cookieless: it sets nothing on your device and
          cannot follow you to other websites. It records the page you landed on,
          the referring site, and coarse details like country and device type, then
          aggregates them. Vercel derives an anonymous visitor identifier from the
          incoming request rather than storing IP addresses, and that identifier is
          not usable to recognize you across days or sites.
        </p>
        <p>
          The result is a chart of how many people read a page. There is no way for
          me — or for anyone reading that chart — to tie a visit back to a person.
        </p>
      </>
    ),
  },
  {
    heading: "The interactive demos",
    body: (
      <p>
        The poker equity calculator sends the cards and settings you choose to an
        API route on this site, which runs a Monte Carlo simulation in memory and
        returns the number. The inputs are not written to a database, not attached
        to any identity, and not retained after the request finishes. Everything
        else on the site runs entirely in your browser.
      </p>
    ),
  },
  {
    heading: "What your own browser keeps",
    body: (
      <p>
        The site stores a single value in your browser&apos;s <Mono>sessionStorage</Mono>{" "}
        (<Mono>intro_seen</Mono>) so the intro animation does not replay on every
        page. It never leaves your device, is never read by me, and your browser
        discards it when you close the tab.
      </p>
    ),
  },
  {
    heading: "Fonts and assets",
    body: (
      <p>
        Fonts are downloaded at build time and served from this domain, so loading
        a page makes no request to Google Fonts or any other font CDN, and the
        icons and screenshots are served from here too. Your IP address is not
        handed to a third party to render the page.
      </p>
    ),
  },
  {
    heading: "Hosting",
    body: (
      <p>
        The site is hosted on{" "}
        <LegalLink href="https://vercel.com/legal/privacy-policy">Vercel</LegalLink>.
        Like every web host on the internet, their servers necessarily process
        your IP address and browser user-agent in order to deliver the page, and
        may keep short-lived operational logs for security and reliability. That
        processing is Vercel&apos;s, governed by their privacy policy; I do not
        query, export, or retain those logs.
      </p>
    ),
  },
  {
    heading: "Links that leave this site",
    body: (
      <p>
        Links to GitHub, LinkedIn, npm, crates.io, and project repositories hand
        you off to services with their own privacy policies. Once you click, this
        policy no longer applies.
      </p>
    ),
  },
  {
    heading: "If you get in touch",
    body: (
      <p>
        There is no contact form here. If you reach me through GitHub, LinkedIn,
        or email, that message lives in the inbox you sent it to, and I use it to
        reply to you and nothing else — no list, no CRM, no forwarding.
      </p>
    ),
  },
  {
    heading: "Your rights",
    body: (
      <p>
        Rights under laws like the GDPR and CCPA — access, correction, deletion,
        portability, opting out of sale — assume someone is holding personal data
        about you. This site holds none, so there is nothing to retrieve or erase.
        If you believe otherwise, or want to ask about any of this, reach me
        through the{" "}
        <LegalLink href="https://github.com/DevomB">GitHub</LegalLink> or{" "}
        <LegalLink href="https://www.linkedin.com/in/devomb/">LinkedIn</LegalLink>{" "}
        links in the footer and I will answer.
      </p>
    ),
  },
  {
    heading: "Children",
    body: (
      <p>
        Nothing here is directed at children, and since no personal information is
        collected from anyone, none is knowingly collected from a child.
      </p>
    ),
  },
  {
    heading: "Changes",
    body: (
      <p>
        If the site ever starts doing something new with data, this page changes
        first and the date at the top changes with it.
      </p>
    ),
  },
  {
    heading: "One more thing",
    body: (
      <p>
        The demos and writing here are provided as-is, and nothing on this site —
        including the trading and backtesting material — is financial advice. That
        is spelled out on the{" "}
        <LegalLink href="/terms">terms of use</LegalLink> page.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lede="This is a personal portfolio, not a product. It is built to collect as close to nothing as a website can."
      updated="August 30, 2026"
    >
      <LegalSummary>
        <p>
          No accounts. No cookies. No ads or tracking pixels. No database. Nothing
          you type into anything on this site — including the interactive demos —
          is saved, logged, or sent anywhere except to compute the answer you asked
          for. The only measurement running is an anonymous, cookieless page-view
          count that cannot identify you.
        </p>
      </LegalSummary>
      {SECTIONS.map((s) => (
        <LegalSection key={s.heading} heading={s.heading}>
          {s.body}
        </LegalSection>
      ))}
    </LegalPage>
  );
}
