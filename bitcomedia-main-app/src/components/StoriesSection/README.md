# StoriesSection Component

A horizontal scrollable section containing multiple Instagram-style stories with navigation controls.

## Features

- **Horizontal scrolling**: Smooth scrolling with momentum on mobile
- **Navigation controls**: Left/right arrow buttons for desktop
- **Responsive design**: Adapts to different screen sizes
- **Theme support**: Compatible with default and teatro911 themes
- **Auto-hiding controls**: Scroll buttons only appear when needed
- **Accessibility**: Keyboard navigation and screen reader support
- **Touch support**: Native touch scrolling on mobile devices

## Usage

```tsx
import StoriesSection from '../../components/StoriesSection';
import { useNavigate } from 'react-router-dom';

const MyComponent = () => {
  const navigate = useNavigate();
  
  const stories = [
    {
      id: 'teatro911',
      imageUrl: '/assets/teatro911/911_logo.png',
      imageAlt: 'Teatro 911',
      title: 'Teatro 911',
      onClick: () => navigate('/911'),
      isHighlighted: true,
      animated: true
    },
    {
      id: 'user1',
      imageUrl: '/user1.jpg',
      imageAlt: 'User story',
      title: 'Mi Show',
      onClick: () => console.log('User story clicked')
    }
  ];

  return (
    <StoriesSection
      stories={stories}
      title="Historias Destacadas"
      theme="teatro911"
    />
  );
};
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stories` | `StoryData[]` | - | **Required**. Array of story data objects |
| `title` | `string` | - | Optional section title |
| `showScrollIndicators` | `boolean` | `true` | Show/hide scroll arrow buttons |
| `storySize` | `'small' \| 'medium' \| 'large'` | `'medium'` | Default size for all stories |
| `theme` | `'default' \| 'teatro911'` | `'default'` | Theme variant |
| `className` | `string` | - | Additional CSS classes |
| `style` | `React.CSSProperties` | - | Inline styles |

## StoryData Interface

```tsx
interface StoryData {
  id: string;                    // Unique identifier
  imageUrl: string;              // Image URL
  imageAlt: string;              // Alt text for accessibility
  title: string;                 // Story title
  onClick: () => void;           // Click handler
  isHighlighted?: boolean;       // Featured story with special styling
  size?: 'small' | 'medium' | 'large'; // Override default size
  animated?: boolean;            // Enable pulsing animation
}
```

## Layout Behavior

### Desktop (768px+)
- Shows navigation arrows when content overflows
- Smooth scrolling with 70% viewport width scroll amount
- Larger gaps between stories (1.5rem)
- Padding: 2rem on sides

### Tablet (576px - 767px)
- Medium gaps (1.25rem)
- Padding: 1.5rem on sides
- Touch scrolling enabled

### Mobile (< 576px)
- Smaller gaps (0.75rem)
- Padding: 0.75rem on sides
- Touch scrolling with momentum
- No navigation arrows (touch-only)

## Responsive Design

The component automatically adjusts:
- **Story spacing**: Smaller gaps on mobile
- **Padding**: Reduced padding on smaller screens
- **Controls**: Arrow buttons hidden on mobile
- **Touch behavior**: Native scroll with momentum on touch devices

## Examples

### Basic Stories Section
```tsx
<StoriesSection
  stories={[
    {
      id: '1',
      imageUrl: '/story1.jpg',
      imageAlt: 'Story 1',
      title: 'Evento 1',
      onClick: () => navigate('/evento/1')
    },
    {
      id: '2',
      imageUrl: '/story2.jpg',
      imageAlt: 'Story 2', 
      title: 'Evento 2',
      onClick: () => navigate('/evento/2')
    }
  ]}
  title="Eventos Destacados"
/>
```

### Featured Teatro911 Section
```tsx
<StoriesSection
  stories={[
    {
      id: 'teatro911',
      imageUrl: '/assets/teatro911/911_logo.png',
      imageAlt: 'Teatro 911 - Entretenimiento en estado de emergencia',
      title: 'Teatro 911',
      onClick: () => navigate('/911'),
      isHighlighted: true,
      animated: true,
      size: 'large'
    }
  ]}
  title="Destacados"
  theme="teatro911"
  storySize="medium"
/>
```

### Without Title
```tsx
<StoriesSection
  stories={storiesData}
  showScrollIndicators={false}
  theme="default"
/>
```

## Accessibility

- Full keyboard navigation support
- Proper ARIA labels for buttons
- Screen reader friendly structure
- High contrast support
- Touch-friendly controls

## Performance

- Efficient scroll handling with throttling
- Minimal re-renders
- Optimized for smooth animations
- Touch momentum scrolling on mobile