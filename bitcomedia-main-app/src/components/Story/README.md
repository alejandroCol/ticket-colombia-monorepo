# Story Component

A reusable Instagram-style story component that displays circular images with customizable themes and interactions.

## Features

- **Instagram-style design**: Circular image with gradient border
- **Multiple sizes**: Small, medium, and large variants
- **Theme support**: Compatible with default and teatro911 themes
- **Interactive**: Hover effects and click handlers
- **Accessibility**: Keyboard navigation support
- **Highlighted stories**: Special gradient for featured content
- **Animations**: Optional pulsing animation

## Usage

```tsx
import Story from '../../components/Story';

// Basic usage
<Story
  imageUrl="/path/to/image.jpg"
  imageAlt="Story description"
  title="Story Title"
  onClick={() => console.log('Story clicked')}
/>

// With all options
<Story
  imageUrl="/path/to/image.jpg"
  imageAlt="Featured story"
  title="Teatro 911"
  onClick={() => navigate('/911')}
  size="large"
  isHighlighted={true}
  animated={true}
  theme="teatro911"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `imageUrl` | `string` | - | **Required**. URL of the story image |
| `imageAlt` | `string` | - | **Required**. Alt text for accessibility |
| `title` | `string` | - | **Required**. Title displayed below the story |
| `onClick` | `() => void` | - | **Required**. Click handler function |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Size of the story circle |
| `isHighlighted` | `boolean` | `false` | Whether to use special rainbow gradient |
| `theme` | `'default' \| 'teatro911'` | `'default'` | Theme variant |
| `animated` | `boolean` | `false` | Enable pulsing animation |
| `className` | `string` | - | Additional CSS classes |
| `style` | `React.CSSProperties` | - | Inline styles |

## Sizes

- **Small**: 50px circle, ideal for compact layouts
- **Medium**: 70px circle, default size for most use cases
- **Large**: 90px circle, for featured or prominent stories

## Themes

### Default Theme
- Uses standard app colors
- Gradient: Primary → Text Primary → Accent

### Teatro911 Theme
- Dark background with red accents
- Gradient: Red (#d9153a) → Blue-gray (#9ababe) → Red
- Special highlighted gradient includes white accents

## Accessibility

- Full keyboard navigation support
- Proper ARIA roles and attributes
- High contrast support
- Screen reader friendly alt text

## Examples

### Basic Story Grid
```tsx
<div style={{ display: 'flex', gap: '1rem' }}>
  <Story
    imageUrl="/user1.jpg"
    imageAlt="User story"
    title="Mi evento"
    onClick={() => {}}
  />
  <Story
    imageUrl="/user2.jpg"
    imageAlt="Another story"
    title="Show"
    onClick={() => {}}
  />
</div>
```

### Featured Teatro911 Story
```tsx
<Story
  imageUrl="/assets/teatro911/911_logo.png"
  imageAlt="Teatro 911"
  title="Teatro 911"
  onClick={() => navigate('/911')}
  size="large"
  isHighlighted={true}
  animated={true}
  theme="teatro911"
/>
```