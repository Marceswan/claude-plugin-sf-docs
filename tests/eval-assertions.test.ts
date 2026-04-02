import {
  citesSource,
  noHallucinatedUrls,
  admitsWhenUncovered,
  hasStructuredAnswer,
  withinReasonableLength,
  noGenericFiller,
  usesCorrectSfTerminology,
  mentionsRelevantObjects,
  includesActionableSteps,
  runAllAssertions,
  allPass,
  extractTopicTreeTitles,
} from '../evals/quality/assertions.js';

// ── Sample skill content with Topic Tree ─────────────────────────────

const SKILL_CONTENT = `---
name: sf-commerce-cloud
description: SME for commerce
---

# SF Commerce Cloud Expert

## Topic Tree

- Associate a Buyer Group with a B2B Store
- Add Accounts to a Buyer Group for a B2B Store
- Entitlement Policies for B2B Stores
- Product Bundles and Sets for B2B Stores
- Enable Semantic Search for Commerce
- Commerce Promotions
- Create Multiple Shipping Profiles for a B2B Store
- Commerce Search Index Troubleshooting
- Agentforce for Guided Shopping for B2B Commerce
- B2B Licenses and Allocations
`;

// ── Known-good output (should pass all assertions) ───────────────────

const GOOD_OUTPUT = `## How to Associate a Buyer Group with a B2B Store

To associate a Buyer Group with your B2B Commerce store, follow these steps:

1. Navigate to **Setup > Commerce > Stores**
2. Select your B2B store from the list
3. Click on the **Buyer Groups** related list
4. Click **Add Buyer Group** and select the Buyer Group you want to associate
5. Enable the entitlement policy for the Buyer Group to control product visibility

### Key Considerations

- Each Buyer Account must be added to at least one Buyer Group to see products
- Buyer Groups control which products and price books are visible to buyers
- You can dynamically assign Buyer Groups using Apex logic

### Entitlement Setup

After associating the Buyer Group, ensure you have an Entitlement Policy that links:
- The Buyer Group to the appropriate Product Catalog
- The correct Price Book for pricing

Source: [Associate a Buyer Group with a B2B Store]

See also: Add Accounts to a Buyer Group for a B2B Store, Entitlement Policies for B2B Stores

For more details, refer to: https://help.salesforce.com/s/articleView?id=sf.b2b_buyer_groups.htm`;

// ── Known-bad generic output (should fail multiple assertions) ───────

const BAD_OUTPUT = `As an AI language model, I don't have access to real-time Salesforce documentation. However, I can provide some general guidance.

Setting up buyer groups typically involves configuring your commerce platform. It depends on your specific use case and requirements.

I'd recommend reaching out to Salesforce support for the most up-to-date information. Please consult the official documentation for detailed steps.

You might also want to check https://docs.example.com/fake-salesforce-guide for more information.`;

// ── Edge case outputs ────────────────────────────────────────────────

const EMPTY_OUTPUT = '';

const SHORT_OUTPUT = 'Yes, B2B Commerce supports buyer groups. Enable them in Setup.';

const FAKE_URL_OUTPUT = `To configure your store, visit https://fake-salesforce.com/setup and follow the guide. Also check https://help.salesforce.com/s/real-article for the official steps.

1. Navigate to Setup > Commerce
2. Select your store
3. Click Enable on the Buyer Group section

Source: [B2B Commerce Setup Guide]

This involves configuring the Buyer Group, Buyer Account, and Entitlement Policy for your B2B Commerce Store. Make sure to set up the Catalog and Product Categories properly.`;

const FABRICATED_OBJECTS_OUTPUT = `To configure your B2B store, use the CommerceCloudManager object to access the B2BStoreConfig settings.

1. Navigate to Setup
2. Click on CommerceCloudManager
3. Enable the StoreAdminService

The Buyer Group and Buyer Account settings are managed through the B2B Commerce Store configuration. Set up your Catalog and Entitlement Policy for proper product visibility.

Source: [Commerce Store Configuration]`;

// ── Tests ────────────────────────────────────────────────────────────

describe('extractTopicTreeTitles', () => {
  it('extracts titles from skill content', () => {
    const titles = extractTopicTreeTitles(SKILL_CONTENT);
    expect(titles).toContain('Associate a Buyer Group with a B2B Store');
    expect(titles).toContain('Commerce Promotions');
    expect(titles.length).toBe(10);
  });

  it('returns empty array for skill without Topic Tree', () => {
    expect(extractTopicTreeTitles('# No tree here')).toEqual([]);
  });
});

describe('Grounding assertions', () => {
  describe('citesSource', () => {
    it('passes when output references a Topic Tree title', () => {
      const output = 'To set this up, see Associate a Buyer Group with a B2B Store for details.';
      expect(citesSource(output, SKILL_CONTENT)).toBe(true);
    });

    it('passes for good output that contains Topic Tree titles', () => {
      expect(citesSource(GOOD_OUTPUT, SKILL_CONTENT)).toBe(true);
    });

    it('fails for generic output that matches no Topic Tree titles', () => {
      expect(citesSource(BAD_OUTPUT, SKILL_CONTENT)).toBe(false);
    });

    it('passes for output with SF URL even without skill content', () => {
      const output = 'See https://help.salesforce.com/s/articleView?id=sf.test for details.';
      expect(citesSource(output)).toBe(true);
    });

    it('fails for empty output', () => {
      expect(citesSource(EMPTY_OUTPUT, SKILL_CONTENT)).toBe(false);
    });

    it('falls back to citation patterns without skill content', () => {
      const output = 'Source: [Some Article Title] describes the process.';
      expect(citesSource(output)).toBe(true);
    });

    it('fails fallback for vague references without skill content', () => {
      const output = 'Check the documentation for more info on buyer groups.';
      expect(citesSource(output)).toBe(false);
    });
  });

  describe('noHallucinatedUrls', () => {
    it('passes for good output with valid SF URLs', () => {
      expect(noHallucinatedUrls(GOOD_OUTPUT)).toBe(true);
    });

    it('fails for output with fake URLs', () => {
      expect(noHallucinatedUrls(BAD_OUTPUT)).toBe(false);
    });

    it('fails for mixed valid and invalid URLs', () => {
      expect(noHallucinatedUrls(FAKE_URL_OUTPUT)).toBe(false);
    });

    it('passes for output with no URLs', () => {
      expect(noHallucinatedUrls('This is a plain text answer about B2B stores.')).toBe(true);
    });

    it('passes for empty output', () => {
      expect(noHallucinatedUrls(EMPTY_OUTPUT)).toBe(true);
    });
  });

  describe('admitsWhenUncovered', () => {
    it('passes for good output', () => {
      expect(admitsWhenUncovered(GOOD_OUTPUT)).toBe(true);
    });

    it('fails for output with fabricated objects', () => {
      expect(admitsWhenUncovered(FABRICATED_OBJECTS_OUTPUT)).toBe(false);
    });

    it('passes for empty output', () => {
      expect(admitsWhenUncovered(EMPTY_OUTPUT)).toBe(true);
    });
  });
});

describe('Structural assertions', () => {
  describe('hasStructuredAnswer', () => {
    it('passes for good output with headers and steps', () => {
      expect(hasStructuredAnswer(GOOD_OUTPUT)).toBe(true);
    });

    it('passes for short output (under 100 words)', () => {
      expect(hasStructuredAnswer(SHORT_OUTPUT)).toBe(true);
    });

    it('fails for long unstructured output', () => {
      // 120+ words of plain paragraphs with no structure
      const unstructured = Array(25).fill('This is a sentence about commerce features and configuration options that spans multiple words.').join(' ');
      expect(hasStructuredAnswer(unstructured)).toBe(false);
    });

    it('passes for empty output', () => {
      expect(hasStructuredAnswer(EMPTY_OUTPUT)).toBe(true);
    });
  });

  describe('withinReasonableLength', () => {
    it('passes for good output', () => {
      expect(withinReasonableLength(GOOD_OUTPUT)).toBe(true);
    });

    it('fails for empty output', () => {
      expect(withinReasonableLength(EMPTY_OUTPUT)).toBe(false);
    });

    it('fails for very short output', () => {
      expect(withinReasonableLength('Yes.')).toBe(false);
    });

    it('fails for extremely long output', () => {
      const long = Array(2500).fill('word').join(' ');
      expect(withinReasonableLength(long)).toBe(false);
    });
  });

  describe('noGenericFiller', () => {
    it('passes for good output', () => {
      expect(noGenericFiller(GOOD_OUTPUT)).toBe(true);
    });

    it('fails for bad output with AI filler', () => {
      expect(noGenericFiller(BAD_OUTPUT)).toBe(false);
    });

    it('passes for empty output', () => {
      expect(noGenericFiller(EMPTY_OUTPUT)).toBe(true);
    });
  });
});

describe('Domain assertions', () => {
  describe('usesCorrectSfTerminology', () => {
    it('passes for good output using Buyer Group', () => {
      expect(usesCorrectSfTerminology(GOOD_OUTPUT)).toBe(true);
    });

    it('passes when buyer mentioned fewer than 3 times', () => {
      const output = 'The buyer can see products. Configure buyer access.';
      expect(usesCorrectSfTerminology(output)).toBe(true);
    });

    it('fails when buyer mentioned 3+ times without proper terms', () => {
      const output = 'The buyer needs access. Set up the buyer portal. The buyer should log in. Configure the buyer experience. The buyer sees products.';
      expect(usesCorrectSfTerminology(output)).toBe(false);
    });
  });

  describe('mentionsRelevantObjects', () => {
    it('passes for good output with commerce terms', () => {
      expect(mentionsRelevantObjects(GOOD_OUTPUT)).toBe(true);
    });

    it('passes for short output (under 80 words)', () => {
      expect(mentionsRelevantObjects(SHORT_OUTPUT)).toBe(true);
    });

    it('fails for long output with no commerce terms', () => {
      const generic = Array(20).fill('This system provides functionality and configuration options for various platform features and settings.').join(' ');
      expect(mentionsRelevantObjects(generic)).toBe(false);
    });
  });

  describe('includesActionableSteps', () => {
    it('passes for good output with numbered steps', () => {
      expect(includesActionableSteps(GOOD_OUTPUT)).toBe(true);
    });

    it('fails for bad output without steps', () => {
      expect(includesActionableSteps(BAD_OUTPUT)).toBe(false);
    });

    it('passes for output with navigation verb', () => {
      const output = 'Navigate to Setup and click Commerce to configure your store.';
      expect(includesActionableSteps(output)).toBe(true);
    });

    it('fails for empty output', () => {
      expect(includesActionableSteps(EMPTY_OUTPUT)).toBe(false);
    });
  });
});

describe('Aggregate functions', () => {
  describe('runAllAssertions', () => {
    it('returns all 9 assertion results', () => {
      const results = runAllAssertions(GOOD_OUTPUT, SKILL_CONTENT);
      expect(Object.keys(results)).toHaveLength(9);
      expect(results).toHaveProperty('citesSource');
      expect(results).toHaveProperty('noHallucinatedUrls');
      expect(results).toHaveProperty('admitsWhenUncovered');
      expect(results).toHaveProperty('hasStructuredAnswer');
      expect(results).toHaveProperty('withinReasonableLength');
      expect(results).toHaveProperty('noGenericFiller');
      expect(results).toHaveProperty('usesCorrectSfTerminology');
      expect(results).toHaveProperty('mentionsRelevantObjects');
      expect(results).toHaveProperty('includesActionableSteps');
    });

    it('all pass for good output with skill content', () => {
      const results = runAllAssertions(GOOD_OUTPUT, SKILL_CONTENT);
      for (const [name, value] of Object.entries(results)) {
        expect({ assertion: name, passed: value }).toEqual({ assertion: name, passed: true });
      }
    });

    it('catches multiple failures in bad output', () => {
      const results = runAllAssertions(BAD_OUTPUT, SKILL_CONTENT);
      expect(results.noGenericFiller).toBe(false);
      expect(results.citesSource).toBe(false);
      expect(results.includesActionableSteps).toBe(false);
      expect(results.noHallucinatedUrls).toBe(false);
    });
  });

  describe('allPass', () => {
    it('returns true for good output with skill content', () => {
      expect(allPass(GOOD_OUTPUT, SKILL_CONTENT)).toBe(true);
    });

    it('returns false for bad output', () => {
      expect(allPass(BAD_OUTPUT, SKILL_CONTENT)).toBe(false);
    });
  });
});
