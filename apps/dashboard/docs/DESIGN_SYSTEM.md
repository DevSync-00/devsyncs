# Design System Documentation

This document outlines the design system, UI components, and styling guidelines for the Dev-Sync.dev dashboard.

## Table of Contents

1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Components](#components)
5. [Icons](#icons)
6. [Animations & Transitions](#animations--transitions)
7. [Responsive Design](#responsive-design)

---

## Color Palette

### Primary Colors

```css
/* Primary brand colors */
--color-primary: #3b82f6;        /* Blue - Primary actions, links */
--color-primary-dark: #2563eb;   /* Darker blue - Hover states */
--color-primary-light: #60a5fa;  /* Lighter blue - Disabled states */

/* Accent colors */
--color-accent: #8b5cf6;         /* Purple - Highlights, badges */
--color-accent-dark: #7c3aed;
```

### Semantic Colors

```css
/* Success */
--color-success: #10b981;        /* Green - Success messages, completed states */
--color-success-light: #d1fae5;

/* Warning */
--color-warning: #f59e0b;        /* Amber - Warnings, pending states */
--color-warning-light: #fef3c7;

/* Error */
--color-error: #ef4444;          /* Red - Errors, failed states */
--color-error-light: #fee2e2;

/* Info */
--color-info: #3b82f6;           /* Blue - Informational messages */
--color-info-light: #dbeafe;
```

### Neutral Colors

```css
/* Grays */
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-400: #9ca3af;
--color-gray-500: #6b7280;
--color-gray-600: #4b5563;
--color-gray-700: #374151;
--color-gray-800: #1f2937;
--color-gray-900: #111827;
```

### Background Colors

```css
--color-bg-primary: #ffffff;     /* Main background */
--color-bg-secondary: #f9fafb;   /* Secondary background (cards, sections) */
--color-bg-tertiary: #f3f4f6;    /* Tertiary background (hover states) */
--color-bg-dark: #1f2937;        /* Dark mode background */
```

### Text Colors

```css
--color-text-primary: #111827;   /* Primary text */
--color-text-secondary: #6b7280;  /* Secondary text */
--color-text-tertiary: #9ca3af; /* Tertiary text (hints, placeholders) */
--color-text-inverse: #ffffff;   /* Text on dark backgrounds */
```

---

## Typography

### Font Family

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
              'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 
              'Helvetica Neue', sans-serif;
```

### Font Sizes

```css
/* Headings */
--text-4xl: 2.25rem;    /* 36px - Page titles */
--text-3xl: 1.875rem;   /* 30px - Section titles */
--text-2xl: 1.5rem;     /* 24px - Card titles */
--text-xl: 1.25rem;     /* 20px - Subsection titles */
--text-lg: 1.125rem;    /* 18px - Large body text */
--text-base: 1rem;      /* 16px - Body text (default) */
--text-sm: 0.875rem;     /* 14px - Small text, captions */
--text-xs: 0.75rem;     /* 12px - Extra small text, labels */
```

### Font Weights

```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights

```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

---

## Spacing & Layout

### Spacing Scale

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
```

### Container Widths

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

### Border Radius

```css
--radius-none: 0;
--radius-sm: 0.125rem;   /* 2px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-full: 9999px;   /* Full circle */
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

---

## Components

### Buttons

#### Primary Button

```tsx
<button className="bg-blue-600 hover:bg-blue-700 text-white font-medium 
                    px-4 py-2 rounded-lg transition-colors">
  Primary Action
</button>
```

#### Secondary Button

```tsx
<button className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium 
                    px-4 py-2 rounded-lg transition-colors">
  Secondary Action
</button>
```

#### Danger Button

```tsx
<button className="bg-red-600 hover:bg-red-700 text-white font-medium 
                    px-4 py-2 rounded-lg transition-colors">
  Delete
</button>
```

#### Button Sizes

- **Small**: `px-3 py-1.5 text-sm`
- **Medium**: `px-4 py-2 text-base` (default)
- **Large**: `px-6 py-3 text-lg`

### Cards

```tsx
<div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
  <h3 className="text-xl font-semibold mb-4">Card Title</h3>
  <p className="text-gray-600">Card content...</p>
</div>
```

### Forms

#### Input Fields

```tsx
<input 
  type="text"
  className="w-full px-4 py-2 border border-gray-300 rounded-lg 
             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
             transition-colors"
  placeholder="Enter text..."
/>
```

#### Labels

```tsx
<label className="block text-sm font-medium text-gray-700 mb-2">
  Field Label
</label>
```

#### Error States

```tsx
<input 
  className="w-full px-4 py-2 border border-red-300 rounded-lg 
             focus:ring-2 focus:ring-red-500 focus:border-red-500"
/>
<p className="mt-1 text-sm text-red-600">Error message</p>
```

### Badges

```tsx
/* Status badges */
<span className="px-2 py-1 text-xs font-medium rounded-full 
                 bg-green-100 text-green-800">
  Success
</span>

<span className="px-2 py-1 text-xs font-medium rounded-full 
                 bg-yellow-100 text-yellow-800">
  Pending
</span>

<span className="px-2 py-1 text-xs font-medium rounded-full 
                 bg-red-100 text-red-800">
  Failed
</span>
```

### Loading States

#### Spinner

```tsx
<div className="flex items-center justify-center">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
</div>
```

#### Skeleton Loaders

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

### Toast Notifications

```tsx
/* Success toast */
<div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
  <p className="text-green-800">Operation completed successfully</p>
</div>

/* Error toast */
<div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
  <p className="text-red-800">An error occurred</p>
</div>
```

---

## Icons

We use [Heroicons](https://heroicons.com/) for consistent iconography.

### Common Icons

- **Check**: `CheckIcon` - Success, completion
- **X**: `XMarkIcon` - Close, cancel, error
- **Plus**: `PlusIcon` - Add, create
- **Trash**: `TrashIcon` - Delete
- **Pencil**: `PencilIcon` - Edit
- **Arrow Right**: `ArrowRightIcon` - Next, continue
- **Information**: `InformationCircleIcon` - Info, help
- **Warning**: `ExclamationTriangleIcon` - Warning, alert

### Usage

```tsx
import { CheckIcon } from '@heroicons/react/24/solid';

<CheckIcon className="h-5 w-5 text-green-600" />
```

---

## Animations & Transitions

### Standard Transitions

```css
/* Hover transitions */
transition-colors duration-200
transition-opacity duration-200
transition-transform duration-200

/* Loading animations */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Common Animation Classes

- **Fade in**: `animate-fade-in`
- **Slide in**: `animate-slide-in`
- **Pulse**: `animate-pulse`
- **Spin**: `animate-spin`

---

## Responsive Design

### Breakpoints

```css
/* Mobile first approach */
sm: 640px   /* Small devices (tablets) */
md: 768px   /* Medium devices (small laptops) */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X Extra large devices */
```

### Usage Example

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

---

## Best Practices

### Accessibility

1. **Color Contrast**: Ensure minimum 4.5:1 contrast ratio for text
2. **Focus States**: Always provide visible focus indicators
3. **ARIA Labels**: Use appropriate ARIA attributes for screen readers
4. **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible

### Performance

1. **Lazy Loading**: Load images and heavy components lazily
2. **Code Splitting**: Split large components into smaller chunks
3. **Optimize Animations**: Use CSS transforms instead of position changes

### Consistency

1. **Spacing**: Use the spacing scale consistently
2. **Colors**: Stick to the defined color palette
3. **Typography**: Follow the typography scale
4. **Components**: Reuse existing components before creating new ones

---

## Component Library

### Available Components

- `Button` - Primary, secondary, danger variants
- `Card` - Container for content sections
- `Input` - Text input fields with validation
- `Select` - Dropdown select fields
- `Badge` - Status indicators
- `Toast` - Notification messages
- `Modal` - Dialog overlays
- `Spinner` - Loading indicators
- `Skeleton` - Loading placeholders

### Usage

Import components from the components directory:

```tsx
import { Button, Card, Input } from '@/components';
```

---

**Last Updated**: Current Date  
**Version**: 1.0.0

