/**
 * Simple markdown parser for footer text
 * Supports: **bold** and [link text](url)
 * No colors or advanced formatting
 */

export function parseMarkdown(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Regular expressions
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  // Combined regex to find all matches
  const combinedRegex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  
  let match;
  const matches: { index: number; length: number; type: 'bold' | 'link'; content: string; url?: string }[] = [];

  // Find all bold matches
  boldRegex.lastIndex = 0;
  while ((match = boldRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'bold',
      content: match[1],
    });
  }

  // Find all link matches
  linkRegex.lastIndex = 0;
  while ((match = linkRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'link',
      content: match[1],
      url: match[2],
    });
  }

  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);

  // Build the result
  matches.forEach((m) => {
    // Add text before this match
    if (currentIndex < m.index) {
      parts.push(text.slice(currentIndex, m.index));
    }

    // Add the formatted content
    if (m.type === 'bold') {
      parts.push(<strong key={`bold-${key++}`}>{m.content}</strong>);
    } else if (m.type === 'link') {
      parts.push(
        <a
          key={`link-${key++}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {m.content}
        </a>
      );
    }

    currentIndex = m.index + m.length;
  });

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.slice(currentIndex));
  }

  return parts.length > 0 ? parts : text;
}
