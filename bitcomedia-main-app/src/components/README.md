# Components Design System

## Overview
Todos los componentes ahora soportan estilos personalizados, temas y variables CSS custom que permiten una alta flexibilidad de personalización.

## Features

### ✨ **Temas Disponibles**
- `default` - Tema principal de la aplicación (usa variables de `main.scss`)
- `teatro911` - Tema específico para Teatro911 con estilo grunge/urban (usa variables de `Teatro911/index.scss`)

### 🎨 **Props de Personalización**
Todos los componentes ahora aceptan estas props adicionales:

```typescript
interface CustomStyleProps {
  /** Theme variant to apply */
  theme?: 'default' | 'teatro911';
  
  /** Custom inline styles */
  style?: React.CSSProperties;
  
  /** Custom CSS variables to inject */
  cssVariables?: Record<string, string>;
  
  /** Additional CSS classes */
  className?: string;
}
```

### 🔧 **Props Específicas (algunos componentes)**
- `grungeEffect?: boolean` - Aplica efectos de texto grunge para el tema teatro911
- `animated?: boolean` - Activa animaciones de pulso

## Usage Examples

### Basic Theme Usage
```tsx
// Default theme
<PrimaryButton>Click me</PrimaryButton>

// Teatro911 theme
<PrimaryButton theme="teatro911">¡STANDUP!</PrimaryButton>
```

### Custom Colors via CSS Variables
```tsx
<PrimaryButton 
  theme="teatro911"
  cssVariables={{
    '--component-accent-color': '#FF0080',
    '--component-text-primary': '#FFFFFF'
  }}
>
  Custom Colors
</PrimaryButton>
```

### Custom Inline Styles
```tsx
<CustomInput 
  theme="teatro911"
  style={{
    fontSize: '1.2rem',
    fontWeight: 900
  }}
  label="Nombre del evento"
/>
```

### Special Effects (Teatro911 only - optional)
```tsx
<PrimaryButton 
  theme="teatro911"
  grungeEffect={true}
  className="with-text-shadow with-uppercase"
>
  Standup en el 911
</PrimaryButton>
```

### Complex Customization
```tsx
<Chip
  label="VIP"
  theme="teatro911"
  color="accent"
  grungeEffect={true}
  cssVariables={{
    '--component-accent-color': '#FF6B9D',
    '--component-text-shadow': '2px 2px 0px #00BFFF, 4px 4px 0px #FFE135',
    '--component-border-width': '3px'
  }}
  style={{
    fontSize: '1.1rem',
    padding: '0.8rem 1.5rem'
  }}
/>
```

## Available CSS Variables

### Colors
- `--component-primary-color`
- `--component-secondary-color`
- `--component-accent-color`
- `--component-text-primary`
- `--component-text-secondary`
- `--component-surface-color`
- `--component-border-color`
- `--component-error-color`
- `--component-success-color`
- `--component-warning-color`

### Typography
- `--component-font-family`
- `--component-font-family-display` (Teatro911 only)
- `--component-font-size`
- `--component-font-weight`
- `--component-line-height`
- `--component-letter-spacing` (Teatro911 only)

### Layout & Effects
- `--component-padding`
- `--component-margin`
- `--component-border-radius`
- `--component-border-width` (Teatro911 only)
- `--component-box-shadow`
- `--component-transition`
- `--component-text-shadow` (Teatro911 only)

### Interactive States
- `--component-button-hover-transform`
- `--component-button-active-transform`

## Teatro911 Theme Features

### 🎭 Subtle Design Differences
- **Color Palette**: Colores vibrantes del teatro (rosa, amarillo, azul)
- **Typography**: Fuente y peso ligeramente diferentes
- **Rounded Corners**: Mantiene bordes redondeados como el tema default
- **Optional Effects**: Efectos especiales disponibles cuando se soliciten explícitamente

### 🌈 Color Palette - Neón Cyberpunk
El tema teatro911 usa exactamente 5 colores (igual estructura que main.scss):

**Colores Base (5 exactos):**
- **Primary** (`#FF0080`) - Magenta vibrante para headlines, botones principales
- **Text Primary** (`#FFFFFF`) - Blanco puro para texto principal
- **Text Secondary** (`#00FF7F`) - Verde lima neón para subtitulos, destacados
- **Surface** (`#0A0A0A`) - Negro intenso para fondos
- **Accent** (`#00D8FF`) - Azul cyan para enlaces, iconos, acentos

**Colores Derivados:**
- **Success/Warning** - Usa Text Secondary (verde lima)
- **Error** - Usa Primary (magenta)
- **Borders** - Usa Accent (cyan)

## Components Updated

✅ **PrimaryButton** - Completamente actualizado
✅ **SecondaryButton** - Completamente actualizado  
✅ **CustomInput** - Completamente actualizado
✅ **Chip** - Completamente actualizado
🔄 **CustomTextarea** - En proceso
🔄 **CustomSelector** - En proceso
🔄 **CustomDateTimePicker** - En proceso
🔄 **Loader** - En proceso
✅ **WhatsAppButton** - Botón de WhatsApp con variantes temáticas

## Best Practices

1. **Use themes consistently** - Stick to one theme per page/section
2. **Teatro911 theme is subtle** - No uppercase text or dramatic effects by default
3. **Leverage CSS variables** - Instead of inline styles when possible
4. **Test responsiveness** - Ensure custom styles work on all screen sizes
5. **Performance** - Avoid excessive CSS variable overrides
6. **Accessibility** - Maintain contrast ratios when customizing colors
7. **Special effects** - Use `grungeEffect`, `with-text-shadow`, `with-uppercase` classes only when needed

## Migration Guide

### Before
```tsx
<PrimaryButton className="my-custom-button">
  Click me
</PrimaryButton>
```

### After  
```tsx
<PrimaryButton 
  theme="teatro911"
  grungeEffect={true}
  className="my-custom-button"
>
  Click me
</PrimaryButton>

// WhatsAppButton con temas
<WhatsAppButton 
  message="Hola, necesito información"
  theme="teatro911"
  className="primary-style"
>
  Contactar por WhatsApp
</WhatsAppButton>
```

No breaking changes! All existing props continue to work as before.