/**
 * Paragraph chunker — splits a long text into overlap-free chunks of roughly
 * `targetChars` characters, breaking at paragraph boundaries first, then at
 * sentence boundaries when paragraphs are too long.
 *
 * Pure char-based; no tokenizer dependency. Good enough for retrieval.
 */
export interface Chunk {
  idx: number;
  text: string;
}

export function chunkText(text: string, targetChars = 1800): Chunk[] {
  const paragraphs = text.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buf = '';
  let idx = 0;
  const flush = () => {
    if (buf.trim()) {
      chunks.push({ idx: idx++, text: buf.trim() });
      buf = '';
    }
  };
  for (const p of paragraphs) {
    if (p.length > targetChars * 1.5) {
      // Paragraph too long — split by sentences.
      flush();
      const sentences = p.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if ((buf + ' ' + s).length > targetChars) flush();
        buf = (buf ? buf + ' ' : '') + s;
      }
      flush();
    } else if ((buf + '\n\n' + p).length > targetChars) {
      flush();
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  flush();
  return chunks;
}
