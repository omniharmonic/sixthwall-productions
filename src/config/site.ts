/**
 * Single source of truth for identity, domains and contact routes.
 *
 * Everything user-facing that is *not* prose lives here: the wordmark, the
 * canonical origin, the contact address. Changing the contact email is a
 * one-line edit in this file — nothing else references the address directly.
 */
export const site = {
  /** Legal / display name. */
  name: 'Sixth Wall Productions',

  /** Split for the header lockup, where the two halves are weighted differently. */
  wordmark: {
    lead: 'Sixth Wall',
    trail: 'Productions',
  },

  /** Canonical origin. Must match public/CNAME and the GitHub Pages custom domain. */
  url: 'https://sixthwall.productions',

  /** Domains that 301 to the canonical origin. Documented here for the record. */
  aliases: ['https://sixthwallproductions.com'],

  /** Public contact route. */
  email: 'hello@sixthwall.productions',

  tagline: 'Theatre has six walls. The last one is the street.',

  /**
   * The opening title, one line per array entry, rendered with a line break
   * between. Braces set a phrase in italics, the same convention the panel
   * headings use — see src/lib/emphasis.ts.
   */
  taglineLines: ['Theatre has six walls.', '{The last one is the street.}'],

  /** The closing statement and call to action. */
  closing: {
    statement: ['A world is a play that', '{enough people kept performing}.'],
    cta: "Tell us what world you're building",
  },

  description:
    'Ritual theatre, immersive worlds, story partnership. Theatre has six walls; we build for the one past the exit, where a play becomes a world.',

  /** Sibling ventures, surfaced as the web presence grows. */
  ventures: {
    apparel: {
      name: 'Sincerely Ironic',
      note: 'Sixth Wall Productions DBA',
      url: 'https://sincerelyironic.com',
      /** Flip to true once the apparel storefront is live to surface the link. */
      live: false,
    },
  },
} as const;

export type Site = typeof site;
