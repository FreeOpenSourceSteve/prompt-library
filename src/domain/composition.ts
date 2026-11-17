import type { Library, PromptContent } from './models';
import { MAX_COMPOSITION_DEPTH, MAX_CONTENT_LENGTH } from './models';

export function normalizedName(name: string): string {
  return name.normalize('NFC').trim().toLowerCase();
}

// Linear scans preserve internal whitespace and avoid backtracking on large bodies.
function boundaryText(text: string): string {
  let start = 0;
  let end = text.length;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === ' ' || char === '\t') index++;
    else if (char === '\n') start = ++index;
    else if (char === '\r' && text[index + 1] === '\n') start = index += 2;
    else break;
  }
  index = text.length - 1;
  while (index >= start) {
    const char = text[index];
    if (char === ' ' || char === '\t') index--;
    else if (char === '\n') {
      index--;
      if (text[index] === '\r') index--;
      end = index + 1;
    } else break;
  }
  return text.slice(start, end);
}

interface TextNode {
  text: string;
  length: number;
  depth: 0;
}
interface GroupNode {
  values: ContentNode[];
  length: number;
  depth: number;
}
type ContentNode = TextNode | GroupNode;
function textNode(text: string): TextNode {
  return { text, length: text.length, depth: 0 };
}
function groupNode(values: ContentNode[]): GroupNode {
  const length =
    values.reduce((total, node) => total + node.length, 0) +
    Math.max(0, values.length - 1) * 2;
  if (length > MAX_CONTENT_LENGTH)
    throw new Error('The assembled prompt exceeds 100,000 characters.');
  return {
    values,
    length,
    depth: 1 + Math.max(0, ...values.map((node) => node.depth)),
  };
}
function renderNode(node: ContentNode, limit = MAX_CONTENT_LENGTH): string {
  const chunks: string[] = [];
  let remaining = limit;
  function append(text: string) {
    if (remaining <= 0) return;
    chunks.push(text.slice(0, remaining));
    remaining -= text.length;
  }
  function visit(node: ContentNode) {
    if ('text' in node) append(node.text);
    else {
      for (const [index, child] of node.values.entries()) {
        if (remaining <= 0) break;
        if (index) append('\n\n');
        visit(child);
      }
    }
  }
  visit(node);
  return chunks.join('');
}

export function joinComponentText(values: string[]): string {
  return renderNode(
    groupNode(values.map((text) => textNode(boundaryText(text)))),
  );
}

// Memoize a compact graph per immutable snapshot. Validation walks lengths and
// depths without flattening shared subgraphs. Full text is materialized on demand
// into an LRU capped at one million characters; previews only walk their prefix.
export function createContentResolver(
  library: Pick<Library, 'prompts' | 'components'>,
) {
  const prompts = new Map(library.prompts.map((item) => [item.id, item]));
  const components = new Map(
    library.components.map((item) => [
      item.id,
      textNode(boundaryText(item.content)),
    ]),
  );
  const memo = new Map<string, ContentNode>();
  const normalized = new WeakMap<TextNode, TextNode>();
  function normalizedNode(node: ContentNode): ContentNode {
    if (!('text' in node)) return node;
    let result = normalized.get(node);
    if (!result) {
      result = textNode(boundaryText(node.text));
      normalized.set(node, result);
    }
    return result;
  }
  const visiting = new Set<string>();
  const texts = new Map<string, string>();
  let cachedCharacters = 0;
  const maxCachedCharacters = 1_000_000;
  function checkDepth(node: ContentNode, level: number) {
    if (node.depth + level > MAX_COMPOSITION_DEPTH)
      throw new Error(
        `Prompts can nest up to ${MAX_COMPOSITION_DEPTH} levels.`,
      );
  }
  function expand(content: PromptContent, level: number): ContentNode {
    if (level > MAX_COMPOSITION_DEPTH)
      throw new Error(
        `Prompts can nest up to ${MAX_COMPOSITION_DEPTH} levels.`,
      );
    if (typeof content === 'string') return textNode(content);
    const values = content.map((part) => {
      if (part.type === 'component') {
        const component = components.get(part.id);
        if (!component)
          throw new Error('A referenced component no longer exists.');
        return component;
      }
      return normalizedNode(resolve(part.id, level + 1));
    });
    const node = groupNode(values);
    checkDepth(node, level);
    return node;
  }
  function resolve(id: string, level = 0): ContentNode {
    const cached = memo.get(id);
    if (cached) {
      checkDepth(cached, level);
      return cached;
    }
    if (visiting.has(id))
      throw new Error('Prompt components cannot contain circular references.');
    const prompt = prompts.get(id);
    if (!prompt) throw new Error('A referenced prompt no longer exists.');
    visiting.add(id);
    try {
      const node = expand(prompt.content, level);
      memo.set(id, node);
      return node;
    } finally {
      visiting.delete(id);
    }
  }
  function prompt(id: string): string {
    const cached = texts.get(id);
    if (cached !== undefined) {
      texts.delete(id);
      texts.set(id, cached);
      return cached;
    }
    const node = resolve(id);
    if ('text' in node) return node.text;
    const text = renderNode(node);
    while (cachedCharacters + text.length > maxCachedCharacters && texts.size) {
      const oldest = texts.entries().next().value;
      if (!oldest) break;
      texts.delete(oldest[0]);
      cachedCharacters -= oldest[1].length;
    }
    texts.set(id, text);
    cachedCharacters += text.length;
    return text;
  }
  return {
    prompt,
    preview: (id: string) => renderNode(resolve(id), 1000),
    check: (id: string) => {
      resolve(id);
    },
    content: (content: PromptContent) => renderNode(expand(content, 0)),
  };
}

export function validateComposition(library: Library): void {
  const ids = new Set(library.prompts.map((item) => item.id));
  const names = new Set<string>();
  const titles = new Set(
    library.prompts.map((item) => normalizedName(item.title)),
  );
  for (const component of library.components) {
    const name = normalizedName(component.name);
    if (names.has(name) || titles.has(name))
      throw new Error(
        'Component names must be unique and different from prompt titles.',
      );
    if (ids.has(component.id))
      throw new Error('Prompt and component IDs must be unique.');
    names.add(name);
    ids.add(component.id);
  }
  const resolver = createContentResolver(library);
  for (const prompt of library.prompts) resolver.check(prompt.id);
}

export function referencingPrompts(
  library: Library,
  type: 'component' | 'prompt',
  id: string,
) {
  return library.prompts.filter(
    (prompt) =>
      Array.isArray(prompt.content) &&
      prompt.content.some((part) => part.type === type && part.id === id),
  );
}
