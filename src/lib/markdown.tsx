/**
 * Simple markdown parser for footer text
 * Supports: **bold** and [link text](url)
 * Bold inside links is supported: [**text**](url)
 */

// Helper to parse bold within text
function parseBold(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`${keyPrefix}-bold-${key++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function parseMarkdown(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Find all link matches first (links take priority)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const matches: { index: number; length: number; content: string; url: string }[] = [];

  while ((match = linkRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      content: match[1],
      url: match[2],
    });
  }

  // Build the result
  matches.forEach((m) => {
    // Add text before this match (parse bold in the text)
    if (currentIndex < m.index) {
      const textBefore = text.slice(currentIndex, m.index);
      parts.push(...parseBold(textBefore, `pre-${key++}`));
    }

    // Add the link with bold parsing inside
    const url = m.url.startsWith('http') ? m.url : `https://${m.url}`;
    parts.push(
      <a
        key={`link-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        {parseBold(m.content, `linktext-${key}`)}
      </a>
    );

    currentIndex = m.index + m.length;
  });

  // Add remaining text (parse bold in it)
  if (currentIndex < text.length) {
    const textAfter = text.slice(currentIndex);
    parts.push(...parseBold(textAfter, `post-${key++}`));
  }

  return parts.length > 0 ? parts : text;
}
