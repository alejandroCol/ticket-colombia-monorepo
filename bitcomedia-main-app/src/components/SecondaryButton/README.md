# Componente SecondaryButton

Un componente de botón secundario para acciones menos destacadas, alternativas o complementarias a las acciones principales.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| children | React.ReactNode | *Requerido* | Contenido del botón |
| onClick | () => void | undefined | Función a ejecutar cuando se hace clic en el botón |
| type | 'button' \| 'submit' \| 'reset' | 'button' | Tipo de botón HTML |
| disabled | boolean | false | Deshabilita la interacción con el botón |
| fullWidth | boolean | false | Hace que el botón ocupe todo el ancho disponible |
| size | 'small' \| 'medium' \| 'large' | 'medium' | Tamaño del botón |
| className | string | '' | Clases CSS adicionales para aplicar al botón |
| loading | boolean | false | Muestra un indicador de carga y deshabilita el botón |

## Ejemplos de uso

### Botón secundario básico
```jsx
<SecondaryButton>Cancelar</SecondaryButton>
```

### Botón secundario como enlace
```jsx
<SecondaryButton onClick={() => navigate('/settings')}>
  Volver a Configuración
</SecondaryButton>
```

### Botón secundario pequeño
```jsx
<SecondaryButton size="small">
  Descartar
</SecondaryButton>
```

### Botón secundario a ancho completo
```jsx
<SecondaryButton fullWidth={true}>
  Ver todos los resultados
</SecondaryButton>
```

### Botón secundario con estado de carga
```jsx
<SecondaryButton 
  loading={isLoading} 
  onClick={handleOperation}>
  Exportar datos
</SecondaryButton>
```

## Implementación en conjunto con botón primario

```jsx
const FormActions = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitData();
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancel = () => {
    resetForm();
    navigate(-1);
  };
  
  return (
    <div className="form-actions-container">
      <SecondaryButton 
        onClick={handleCancel}
        disabled={isSubmitting}>
        Cancelar
      </SecondaryButton>
      
      <PrimaryButton 
        onClick={handleSubmit}
        loading={isSubmitting}>
        Guardar
      </PrimaryButton>
    </div>
  );
};
``` 