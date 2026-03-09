# Componente PrimaryButton

Un componente de botón principal para acciones destacadas y llamados a la acción importantes, con soporte para diferentes tamaños, estados y opciones de diseño.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| children | React.ReactNode | *Requerido* | Contenido del botón |
| type | 'button' \| 'submit' \| 'reset' | 'button' | Tipo de botón HTML |
| onClick | (e: React.MouseEvent<HTMLButtonElement>) => void | undefined | Función a ejecutar cuando se hace clic en el botón |
| disabled | boolean | false | Deshabilita la interacción con el botón |
| className | string | '' | Clases CSS adicionales para aplicar al botón |
| fullWidth | boolean | false | Hace que el botón ocupe todo el ancho disponible |
| size | 'small' \| 'medium' \| 'large' | 'medium' | Tamaño del botón |
| icon | React.ReactNode | undefined | Icono a mostrar junto al texto del botón |
| iconPosition | 'left' \| 'right' | 'left' | Posición del icono respecto al texto |
| loading | boolean | false | Muestra un indicador de carga y deshabilita el botón |
| form | string | undefined | Asocia el botón con un formulario específico por ID |
| ariaLabel | string | undefined | Etiqueta ARIA para accesibilidad |

## Ejemplos de uso

### Botón primario básico
```jsx
<PrimaryButton>Guardar cambios</PrimaryButton>
```

### Botón de envío de formulario
```jsx
<PrimaryButton 
  type="submit" 
  form="my-form">
  Enviar formulario
</PrimaryButton>
```

### Botón con icono
```jsx
<PrimaryButton 
  icon={<SaveIcon />} 
  iconPosition="left">
  Guardar
</PrimaryButton>
```

### Botón de tamaño grande y ancho completo
```jsx
<PrimaryButton 
  size="large" 
  fullWidth={true}>
  Continuar
</PrimaryButton>
```

### Botón en estado de carga
```jsx
<PrimaryButton 
  loading={isLoading} 
  onClick={handleSubmit}>
  {isLoading ? 'Procesando...' : 'Procesar pago'}
</PrimaryButton>
```

## Implementación en un formulario

```jsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    await submitForm(formData);
    showSuccessMessage();
  } catch (error) {
    showErrorMessage(error);
  } finally {
    setIsSubmitting(false);
  }
};

// ...

<form id="profile-form">
  {/* Campos del formulario */}
</form>

<div className="form-actions">
  <SecondaryButton 
    onClick={handleCancel}>
    Cancelar
  </SecondaryButton>
  
  <PrimaryButton 
    type="submit" 
    form="profile-form"
    loading={isSubmitting}>
    Guardar perfil
  </PrimaryButton>
</div>
``` 