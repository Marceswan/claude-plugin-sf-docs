import { Summarizer } from '../src/summarizer.js';

describe('Summarizer', () => {
  const sampleDocs = [
    {
      id: 'commerce.comm_intro',
      title: 'Introduction to Commerce',
      content: [
        '# Introduction to Commerce',
        '',
        'Salesforce Commerce Cloud enables businesses to create unified buying experiences.',
        '',
        '## Store Types',
        '',
        'Commerce Cloud supports B2B and D2C store types. Each type has specific features.',
        '',
        '## Buyer Groups',
        '',
        'Buyer groups control which products and pricing are available to specific customers.',
        '',
        '### Assigning Buyers',
        '',
        'Assign buyer accounts to buyer groups to grant access.',
      ].join('\n'),
    },
    {
      id: 'commerce.comm_checkout',
      title: 'Checkout Configuration',
      content: [
        '# Checkout Configuration',
        '',
        'Configure checkout flows for your commerce store.',
        '',
        '## Managed Checkout',
        '',
        'Managed checkout provides a pre-built checkout experience with minimal configuration.',
        '',
        '## Custom Checkout',
        '',
        'Custom checkout lets you build your own checkout flow using Lightning Web Components.',
        '',
        '## Payment Methods',
        '',
        'Configure payment gateways and accepted payment methods for your store.',
      ].join('\n'),
    },
    {
      id: 'commerce.comm_search',
      title: 'Search Configuration',
      content: [
        '# Search Configuration',
        '',
        'Configure product search for your commerce store.',
        '',
        '## Search Index',
        '',
        'The search index must be built before products appear in search results.',
        '',
        '## Buyer Groups',
        '',
        'Buyer groups filter search results based on entitlement policies.',
      ].join('\n'),
    },
  ];

  test('extractHeadingTree returns structured headings', () => {
    const summarizer = new Summarizer();
    const tree = summarizer.extractHeadingTree(sampleDocs);
    // Should have top-level H1 headings
    expect(tree.some(h => h.text === 'Introduction to Commerce')).toBe(true);
    expect(tree.some(h => h.text === 'Checkout Configuration')).toBe(true);
    // Should have H2 children
    const intro = tree.find(h => h.text === 'Introduction to Commerce');
    expect(intro!.children.some(c => c.text === 'Store Types')).toBe(true);
    expect(intro!.children.some(c => c.text === 'Buyer Groups')).toBe(true);
    // Should have H3 children
    const buyerGroups = intro!.children.find(c => c.text === 'Buyer Groups');
    expect(buyerGroups!.children.some(c => c.text === 'Assigning Buyers')).toBe(true);
  });

  test('extractConcepts returns first paragraph under each H2', () => {
    const summarizer = new Summarizer();
    const concepts = summarizer.extractConcepts(sampleDocs);
    expect(concepts).toContainEqual({
      term: 'Store Types',
      definition: 'Commerce Cloud supports B2B and D2C store types. Each type has specific features.',
    });
    expect(concepts).toContainEqual({
      term: 'Managed Checkout',
      definition: 'Managed checkout provides a pre-built checkout experience with minimal configuration.',
    });
  });

  test('extractConcepts deduplicates terms by name', () => {
    const summarizer = new Summarizer();
    const concepts = summarizer.extractConcepts(sampleDocs);
    // "Buyer Groups" appears in both comm_intro and comm_search — keep first occurrence
    const bgConcepts = concepts.filter(c => c.term === 'Buyer Groups');
    expect(bgConcepts).toHaveLength(1);
    expect(bgConcepts[0].definition).toContain('control which products');
  });

  test('generateSummary respects maxTokens cap', () => {
    const summarizer = new Summarizer();
    // With a very small cap, the output should be truncated
    const summary = summarizer.generateSummary(sampleDocs, 50);
    // Should still produce something but be short
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThan(2000); // rough char check
  });

  test('generateSummary includes heading tree and concepts', () => {
    const summarizer = new Summarizer();
    const summary = summarizer.generateSummary(sampleDocs, 4000);
    expect(summary).toContain('## Topic Tree');
    expect(summary).toContain('## Key Concepts');
    expect(summary).toContain('Store Types');
    expect(summary).toContain('Managed Checkout');
  });
});
