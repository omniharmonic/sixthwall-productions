import { getCollection, render, type CollectionEntry } from 'astro:content';

export type PanelEntry = CollectionEntry<'panels'>;

export interface RenderedPanel {
  entry: PanelEntry;
  /** The markdown body, compiled to an Astro component. */
  Content: Awaited<ReturnType<typeof render>>['Content'];
}

/**
 * Fails the build if the timeline is internally inconsistent.
 *
 * These are the mistakes that produce a site which *builds fine* and then
 * quietly misbehaves — two panels fighting for the same scroll window, or two
 * walls lighting the same cube face. Cheaper to catch here than in a browser.
 */
function assertCoherentTimeline(panels: PanelEntry[]): void {
  const seenOrder = new Map<number, string>();
  const seenFace = new Map<number, string>();

  for (const panel of panels) {
    const { order, face } = panel.data;

    const orderClash = seenOrder.get(order);
    if (orderClash) {
      throw new Error(
        `Panel order ${order} is used by both "${orderClash}" and "${panel.id}". Orders must be unique.`,
      );
    }
    seenOrder.set(order, panel.id);

    if (face !== undefined) {
      const faceClash = seenFace.get(face);
      if (faceClash) {
        throw new Error(
          `Cube face ${face} is claimed by both "${faceClash}" and "${panel.id}". Each of the six walls lights exactly one face.`,
        );
      }
      seenFace.set(face, panel.id);
    }
  }

  for (let index = 1; index < panels.length; index += 1) {
    const previous = panels[index - 1]!;
    const current = panels[index]!;
    if (current.data.scrollIn < previous.data.scrollIn) {
      throw new Error(
        `"${current.id}" comes after "${previous.id}" by order but starts earlier on the scroll timeline.`,
      );
    }
  }
}

/** Every panel, in scroll order, with its markdown body compiled. */
export async function getPanels(): Promise<RenderedPanel[]> {
  const entries = await getCollection('panels');
  const ordered = [...entries].sort((a, b) => a.data.order - b.data.order);

  assertCoherentTimeline(ordered);

  return Promise.all(
    ordered.map(async (entry) => ({
      entry,
      Content: (await render(entry)).Content,
    })),
  );
}
