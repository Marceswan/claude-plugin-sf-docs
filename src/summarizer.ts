import { getEncoding } from 'js-tiktoken';

export interface HeadingNode {
  text: string;
  level: number;
  children: HeadingNode[];
}

export interface Concept {
  term: string;
  definition: string;
}

interface DocInput {
  id: string;
  title: string;
  content: string;
}

export class Summarizer {
  private encoder = getEncoding('cl100k_base');

  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }

  extractHeadingTree(docs: DocInput[]): HeadingNode[] {
    const roots: HeadingNode[] = [];

    for (const doc of docs) {
      const lines = doc.content.split('\n');
      let currentH1: HeadingNode | null = null;
      let currentH2: HeadingNode | null = null;

      for (const line of lines) {
        const h1Match = line.match(/^#\s+(.+)/);
        const h2Match = line.match(/^##\s+(.+)/);
        const h3Match = line.match(/^###\s+(.+)/);

        if (h1Match && !h2Match) {
          currentH1 = { text: h1Match[1], level: 1, children: [] };
          if (!roots.some(r => r.text === currentH1!.text)) {
            roots.push(currentH1);
          } else {
            currentH1 = roots.find(r => r.text === currentH1!.text)!;
          }
          currentH2 = null;
        } else if (h2Match && !h3Match) {
          const node: HeadingNode = { text: h2Match[1], level: 2, children: [] };
          if (currentH1 && !currentH1.children.some(c => c.text === node.text)) {
            currentH1.children.push(node);
          }
          currentH2 = node;
        } else if (h3Match) {
          const node: HeadingNode = { text: h3Match[1], level: 3, children: [] };
          if (currentH2 && !currentH2.children.some(c => c.text === node.text)) {
            currentH2.children.push(node);
          }
        }
      }
    }

    return roots;
  }

  extractConcepts(docs: DocInput[]): Concept[] {
    const concepts: Concept[] = [];
    const seen = new Set<string>();

    for (const doc of docs) {
      const lines = doc.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const h2Match = lines[i].match(/^##\s+(.+)/);
        const h3Match = lines[i].match(/^###\s+/);
        if (!h2Match || h3Match) continue;

        const term = h2Match[1];
        if (seen.has(term)) continue;

        let definition = '';
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j].trim();
          if (line === '') continue;
          if (line.startsWith('#')) break;
          definition = line;
          break;
        }

        if (definition) {
          seen.add(term);
          concepts.push({ term, definition });
        }
      }
    }

    return concepts;
  }

  generateSummary(docs: DocInput[], maxTokens: number): string {
    const tree = this.extractHeadingTree(docs);
    const concepts = this.extractConcepts(docs);

    const sections: string[] = [];

    const treeLines = ['## Topic Tree', ''];
    for (const root of tree) {
      treeLines.push(`- ${root.text}`);
      for (const child of root.children) {
        treeLines.push(`  - ${child.text}`);
        for (const grandchild of child.children) {
          treeLines.push(`    - ${grandchild.text}`);
        }
      }
    }
    sections.push(treeLines.join('\n'));

    const conceptLines = ['## Key Concepts', ''];
    for (const c of concepts) {
      conceptLines.push(`**${c.term}:** ${c.definition}`);
      conceptLines.push('');
    }
    sections.push(conceptLines.join('\n'));

    let result = sections.join('\n\n');
    let tokens = this.countTokens(result);

    if (tokens <= maxTokens) return result;

    const treeSection = sections[0];
    const treeTokens = this.countTokens(treeSection);

    if (treeTokens > maxTokens) {
      const lines = treeSection.split('\n');
      let truncated = '';
      for (const line of lines) {
        const candidate = truncated + line + '\n';
        if (this.countTokens(candidate) > maxTokens) break;
        truncated = candidate;
      }
      return truncated.trim();
    }

    const remainingBudget = maxTokens - treeTokens - 10;
    const conceptHeader = '## Key Concepts\n\n';
    let conceptText = conceptHeader;
    for (const c of concepts) {
      const entry = `**${c.term}:** ${c.definition}\n\n`;
      if (this.countTokens(conceptText + entry) > remainingBudget) break;
      conceptText += entry;
    }

    return treeSection + '\n\n' + conceptText.trim();
  }
}
