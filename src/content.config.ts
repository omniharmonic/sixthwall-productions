import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * The scrolling copy panels.
 *
 * Each entry owns its own slice of the 0 → 1 scroll timeline. Panels that
 * carry a `face` also light the corresponding face of the cube net and its
 * rail tick over the same window — so timing is stated once, here, and the
 * three things it drives can never drift apart.
 */
const panels = defineCollection({
  loader: glob({ base: './src/content/panels', pattern: '**/*.md' }),
  schema: z
    .object({
      /** Sort order along the scroll. */
      order: z.number().int().positive(),

      /**
       * Index of the cube face this panel lights, 0-5, for the six walls.
       * Omit for panels that are not one of the walls.
       */
      face: z.number().int().min(0).max(5).optional(),

      /** Small uppercase label above the heading. */
      eyebrow: z.string().min(1),

      /**
       * Display heading. Wrap a phrase in braces to set it in italics:
       * "Something wants to {be made}" renders "be made" italic.
       */
      heading: z.string().min(1),

      /** Scroll progress at which the panel begins to fade in. */
      scrollIn: z.number().min(0).max(1),

      /** Scroll progress at which the panel has fully faded out. */
      scrollOut: z.number().min(0).max(1),
    })
    .refine((panel) => panel.scrollIn < panel.scrollOut, {
      message: 'scrollIn must come before scrollOut',
      path: ['scrollIn'],
    }),
});

/**
 * The long-form pages past the home scroll: the walls, the rite, the worlds,
 * the partnership. One markdown file per page; the filename is the route.
 *
 * The home page is the cube, closed and presentable. These are the net — the
 * same thing unfolded so it can be read. They draw on the source texts in
 * canon/, which is where the deeper material lives and where provenance is
 * kept. Keep the pages the performance and the canon the script.
 */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '*.md' }),
  schema: z.object({
    /** Order in the site navigation. */
    order: z.number().int().positive(),

    /** Short label for the masthead and the doors at the foot of every page. */
    nav: z.string().min(1),

    /** Small uppercase label above the title. */
    eyebrow: z.string().min(1),

    /** Display title. Braces italicise, as in panel headings. */
    title: z.string().min(1),

    /** One or two sentences under the title, set large. Braces italicise. */
    lede: z.string().min(1),

    /** Meta description, ~150 characters. */
    description: z.string().min(1).max(200),
  }),
});

export const collections = { panels, pages };
