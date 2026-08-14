const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/**
 * Renders a heading's braced phrase in italics.
 *
 *   emphasize('Something wants to {be made}')
 *     → 'Something wants to <i>be made</i>'
 *
 * Headings are authored as plain strings in frontmatter rather than as raw
 * HTML, so the input is escaped first and the only markup this can ever
 * produce is the <i> we add. Braces survive escaping untouched.
 */
export function emphasize(heading: string): string {
  return escapeHtml(heading).replace(/\{([^}]+)\}/g, '<i>$1</i>');
}

/** The heading with its emphasis markers removed, for <title> and meta tags. */
export function plainText(heading: string): string {
  return heading.replace(/[{}]/g, '');
}
