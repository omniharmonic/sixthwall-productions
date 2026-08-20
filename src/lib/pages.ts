import { getCollection, type CollectionEntry } from 'astro:content';

export type PageEntry = CollectionEntry<'pages'>;

/** Every long-form page, in navigation order. */
export async function getPages(): Promise<PageEntry[]> {
  const entries = await getCollection('pages');
  const ordered = [...entries].sort((a, b) => a.data.order - b.data.order);

  const seen = new Map<number, string>();
  for (const page of ordered) {
    const clash = seen.get(page.data.order);
    if (clash) {
      throw new Error(
        `Page order ${page.data.order} is used by both "${clash}" and "${page.id}". Orders must be unique.`,
      );
    }
    seen.set(page.data.order, page.id);
  }

  return ordered;
}

/** The route a page is served at. The filename is the slug. */
export const pageHref = (page: PageEntry): string => `/${page.id}`;
