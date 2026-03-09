# Componente Chip

Un componente flexible para mostrar etiquetas, categorías o filtros interactivos con estilos personalizables.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| label | string | *Requerido* | Texto a mostrar dentro del chip |
| onClick | () => void | undefined | Función a ejecutar cuando se hace clic en el chip |
| active | boolean | false | Determina si el chip está activo/seleccionado |
| disabled | boolean | false | Deshabilita la interacción con el chip |
| className | string | '' | Clases CSS adicionales para aplicar al chip |
| icon | React.ReactNode | undefined | Icono a mostrar antes del texto del chip |
| color | 'default' \| 'primary' \| 'accent' \| 'success' \| 'warning' \| 'error' | 'default' | Esquema de color del chip |
| size | 'small' \| 'medium' \| 'large' | 'medium' | Tamaño del chip |

## Ejemplos de uso

### Chip básico
```jsx
<Chip label="Categoría" />
```

### Chip con color acento y activo
```jsx
<Chip 
  label="Música" 
  color="accent" 
  active={true} 
/>
```

### Chip clickeable
```jsx
<Chip 
  label="Filtro" 
  onClick={() => console.log("Chip clicked")} 
/>
```

### Chip con icono
```jsx
<Chip 
  label="Nueva" 
  icon={<StarIcon />}
  color="success" 
/>
```

### Chip pequeño y deshabilitado
```jsx
<Chip 
  label="No disponible" 
  size="small" 
  disabled={true} 
/>
```

## Implementación en una lista de categorías

```jsx
const categories = ['Música', 'Deportes', 'Arte', 'Tecnología'];
const [activeCategory, setActiveCategory] = useState(null);

// ...

<div className="category-list">
  {categories.map((category) => (
    <Chip
      key={category}
      label={category}
      color="accent"
      active={activeCategory === category}
      onClick={() => setActiveCategory(
        activeCategory === category ? null : category
      )}
    />
  ))}
</div>
``` 