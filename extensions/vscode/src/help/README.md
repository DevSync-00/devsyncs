# Contextual Help System

This module provides comprehensive contextual help for the DevSync VS Code extension, addressing section 3.2 from the IMPROVEMENTS.md roadmap.

## Features

### 1. Contextual Tooltips

Tooltips are available for all UI elements:

- **Commands**: Tooltips for all DevSync commands
- **Sidebar Items**: Tooltips for sidebar tree items
- **Diagnostics**: Tooltips for inline diagnostics
- **Status Bar**: Tooltips for status bar items

```typescript
import { TooltipManager } from './help';

// Register a tooltip
TooltipManager.register('command.scan', {
  text: 'Scan your Prisma schema and database for mismatches',
  markdown: HelpContent.getTooltip('scan'),
  docLink: 'https://docs.devsync.ai/scanning',
  videoLink: 'https://docs.devsync.ai/videos/scanning',
});

// Create tree item with tooltip
const item = TooltipManager.createTreeItemWithTooltip(
  'Scan Schema',
  'command.scan'
);
```

### 2. Inline Help Panels

Help panels can be displayed in the editor or sidebar:

```typescript
import { HelpPanelManager } from './help';

await HelpPanelManager.showHelpPanel(context, 'scan-help', {
  title: 'How to Scan Your Schema',
  content: HelpContent.getTooltip('scan'),
  docLink: 'https://docs.devsync.ai/scanning',
  videoLink: 'https://docs.devsync.ai/videos/scanning',
  position: 'editor',
});
```

### 3. Interactive Tutorials

Step-by-step interactive tutorials guide users through features:

```typescript
import { TutorialManager } from './help';

// Start a tutorial
await TutorialManager.startTutorial(context, 'getting-started');

// Register a custom tutorial
TutorialManager.registerTutorial({
  id: 'custom-tutorial',
  title: 'Custom Tutorial',
  description: 'Learn about custom features',
  steps: [
    {
      title: 'Step 1',
      description: 'Description',
      instructions: 'Instructions',
      action: {
        command: 'devsync.scan',
      },
    },
  ],
});
```

### 4. Documentation Links

All help content includes links to relevant documentation:

```typescript
import { HelpContent } from './help';

const docLink = HelpContent.getDocLink('scanning');
const videoLink = HelpContent.getVideoLink('scanning');
```

### 5. Video Guides

Video guides are integrated into tooltips and help panels:

- Scanning tutorial
- Migration generation guide
- Dashboard overview
- Getting started series

### 6. FAQ Section

Searchable FAQ with common questions and answers:

```typescript
import { FAQManager } from './help';

// Show FAQ
await FAQManager.showFAQ(context);

// Search FAQ
await FAQManager.showFAQ(context, 'migration');

// Register FAQ items
FAQManager.registerFAQ([
  {
    question: 'How do I scan my schema?',
    answer: 'Click the Scan button...',
    tags: ['scan', 'getting-started'],
    docLink: 'https://docs.devsync.ai/scanning',
  },
]);
```

### 7. Community Forum Integration

Integration with community forum for support:

```typescript
import { CommunityManager } from './help';

// Open forum
await CommunityManager.openForum();

// Search forum
await CommunityManager.searchForum('migration issues');

// Show community panel
await CommunityManager.showCommunityPanel(context);
```

## Usage Examples

### Complete Help System Integration

```typescript
import {
  initializeHelpSystem,
  TooltipManager,
  HelpPanelManager,
  TutorialManager,
  FAQManager,
  CommunityManager,
} from './help';

// Initialize on extension activation
export function activate(context: vscode.ExtensionContext) {
  initializeHelpSystem(context);
  
  // Register commands
  vscode.commands.registerCommand('devsync.help.showFAQ', () => {
    FAQManager.showFAQ(context);
  });
  
  vscode.commands.registerCommand('devsync.help.startTutorial', () => {
    TutorialManager.startTutorial(context, 'getting-started');
  });
  
  vscode.commands.registerCommand('devsync.help.community', () => {
    CommunityManager.showCommunityPanel(context);
  });
}
```

## Integration Points

The help system integrates with:

- **Sidebar Provider**: Tooltips for tree items
- **Commands**: Help panels for commands
- **Diagnostics**: Tooltips for diagnostic messages
- **Code Actions**: Help for suggested fixes
- **Onboarding**: Tutorials for new users

## Future Enhancements

- Context-aware help based on user actions
- Help content localization
- Analytics for help usage
- User feedback on help content
- Interactive help widgets
- Help content versioning

