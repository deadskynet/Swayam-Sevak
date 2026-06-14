/**
 * Tiny markdown renderer — covers headings, paragraphs, code (inline + fenced),
 * bold/italic, lists, links. Not exhaustive (no tables, no nested lists), but
 * good enough for the memory/log/session text we display. Zero dependencies.
 *
 * Always escape first, then apply markdown rules — order matters for safety.
 */

export function renderMarkdown(src: string): string {
  let s = escapeHtml(src);

  // Fenced code blocks ```...```
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);

  // Headings (## , ### …)
  s = s.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  s = s.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  s = s.replace(/^####\s+(.+)$/gm,  '<h4>$1</h4>');
  s = s.replace(/^###\s+(.+)$/gm,   '<h3>$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm,    '<h2>$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm,     '<h1>$1</h1>');

  // Bold + italic.
  s = s.replace(/\*\*([^\*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');

  // Inline code.
  s = s.replace(/`([^`]+?)`/g, '<code>$1</code>');

  // Links [text](url)
  s = s.replace(/\[([^\]]+?)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const href = /^https?:\/\//.test(u) ? u : `#${u}`;
    return `<a href="${href}" rel="noopener" target="_blank">${t}</a>`;
  });

  // Bullet list lines.
  s = s.replace(/(^|\n)([ ]*[-*]\s+.+(?:\n[ ]*[-*]\s+.+)*)/g, (_, lead, block) => {
    const items = block
      .split(/\n/)
      .map((l: string) => l.replace(/^[ ]*[-*]\s+/, ''))
      .map((l: string) => `<li>${l}</li>`)
      .join('');
    return `${lead}<ul>${items}</ul>`;
  });

  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
