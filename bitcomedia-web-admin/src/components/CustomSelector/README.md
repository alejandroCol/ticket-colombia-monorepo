# Componente CustomSelector

Un componente de selección desplegable personalizado para elegir opciones de una lista predefinida, con soporte para diversos estados y validación.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| name | string | undefined | Nombre del campo de selección |
| label | string | undefined | Etiqueta descriptiva del campo |
| value | string \| number | undefined | Valor seleccionado actualmente |
| options | Option[] | *Requerido* | Array de opciones disponibles para seleccionar |
| onChange | (e: ChangeEvent<HTMLSelectElement>) => void | undefined | Función que se ejecuta al seleccionar una opción |
| onBlur | (e: FocusEvent<HTMLSelectElement>) => void | undefined | Función que se ejecuta cuando el campo pierde el foco |
| onFocus | (e: FocusEvent<HTMLSelectElement>) => void | undefined | Función que se ejecuta cuando el campo recibe el foco |
| required | boolean | false | Indica si la selección es obligatoria |
| disabled | boolean | false | Deshabilita la interacción con el selector |
| error | string | undefined | Mensaje de error a mostrar debajo del campo |
| className | string | '' | Clases CSS adicionales |
| icon | React.ReactNode | undefined | Icono a mostrar junto al selector |
| placeholder | string | undefined | Texto mostrado cuando no hay selección |

## Ejemplos de uso

### Selector básico
```jsx
const options = [
  { value: 'option1', label: 'Opción 1' },
  { value: 'option2', label: 'Opción 2' },
  { value: 'option3', label: 'Opción 3' }
];

<CustomSelector 
  label="Selecciona una opción"
  name="selection"
  value={selectedOption}
  options={options}
  onChange={(e) => setSelectedOption(e.target.value)}
/>
```

### Selector con placeholder
```jsx
<CustomSelector 
  label="Categoría" 
  name="category"
  value={category}
  options={categories}
  onChange={handleCategoryChange}
  placeholder="Selecciona una categoría"
/>
```

### Selector con icono y validación
```jsx
<CustomSelector 
  label="País"
  name="country"
  value={country}
  options={countries}
  onChange={handleCountryChange}
  icon={<GlobeIcon />}
  required={true}
  error={countryError}
/>
```

### Selector deshabilitado
```jsx
<CustomSelector 
  label="Plan"
  name="plan"
  value={plan}
  options={plans}
  disabled={isSubscribed}
/>
```

## Implementación en un formulario de filtro

```jsx
const [filters, setFilters] = useState({
  category: '',
  sortBy: 'recent',
  status: 'all'
});

const categories = [
  { value: 'technology', label: 'Tecnología' },
  { value: 'business', label: 'Negocios' },
  { value: 'health', label: 'Salud' },
  { value: 'arts', label: 'Arte y Cultura' }
];

const sortOptions = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'popular', label: 'Más populares' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' }
];

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'completed', label: 'Completados' },
  { value: 'pending', label: 'Pendientes' }
];

const handleFilterChange = (e) => {
  const { name, value } = e.target;
  setFilters(prev => ({
    ...prev,
    [name]: value
  }));
};

// ...

<div className="filters-container">
  <CustomSelector 
    label="Categoría"
    name="category"
    value={filters.category}
    options={categories}
    onChange={handleFilterChange}
    placeholder="Todas las categorías"
    icon={<FilterIcon />}
  />
  
  <CustomSelector 
    label="Ordenar por"
    name="sortBy"
    value={filters.sortBy}
    options={sortOptions}
    onChange={handleFilterChange}
    icon={<SortIcon />}
  />
  
  <CustomSelector 
    label="Estado"
    name="status"
    value={filters.status}
    options={statusOptions}
    onChange={handleFilterChange}
    icon={<StatusIcon />}
  />
  
  <PrimaryButton onClick={applyFilters}>
    Aplicar filtros
  </PrimaryButton>
</div>
``` 