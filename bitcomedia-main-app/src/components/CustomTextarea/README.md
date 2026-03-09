# Componente CustomTextarea

Un componente de área de texto personalizado para la entrada de texto multilínea con diversos estados y opciones de validación.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| name | string | undefined | Nombre del campo |
| label | string | undefined | Etiqueta descriptiva del campo |
| value | string | undefined | Valor actual del campo |
| placeholder | string | undefined | Texto de ayuda mostrado cuando el campo está vacío |
| onChange | (e: ChangeEvent<HTMLTextAreaElement>) => void | undefined | Función que se ejecuta al cambiar el valor |
| onBlur | (e: FocusEvent<HTMLTextAreaElement>) => void | undefined | Función que se ejecuta cuando el campo pierde el foco |
| onFocus | (e: FocusEvent<HTMLTextAreaElement>) => void | undefined | Función que se ejecuta cuando el campo recibe el foco |
| required | boolean | false | Indica si el campo es obligatorio |
| disabled | boolean | false | Deshabilita la interacción con el campo |
| error | string | undefined | Mensaje de error a mostrar debajo del campo |
| className | string | '' | Clases CSS adicionales |
| rows | number | 4 | Número de filas visibles |
| maxLength | number | undefined | Número máximo de caracteres permitidos |
| minLength | number | undefined | Número mínimo de caracteres requeridos |
| readOnly | boolean | false | Hace que el campo sea de solo lectura |

## Ejemplos de uso

### Área de texto básica
```jsx
<CustomTextarea 
  label="Comentarios"
  name="comments"
  value={comments}
  onChange={(e) => setComments(e.target.value)}
/>
```

### Área de texto con marcador de posición
```jsx
<CustomTextarea 
  label="Descripción" 
  name="description"
  value={description}
  onChange={handleDescriptionChange}
  placeholder="Describe tu producto en detalle..."
/>
```

### Área de texto con validación
```jsx
<CustomTextarea 
  label="Biografía"
  name="bio"
  value={bio}
  onChange={handleBioChange}
  minLength={50}
  maxLength={500}
  error={bioError}
  required={true}
/>
```

### Área de texto con filas personalizadas
```jsx
<CustomTextarea 
  label="Instrucciones detalladas"
  name="instructions"
  value={instructions}
  onChange={handleInstructionsChange}
  rows={8}
/>
```

### Área de texto deshabilitada
```jsx
<CustomTextarea 
  label="Términos y condiciones"
  name="terms"
  value={terms}
  readOnly={true}
  disabled={true}
/>
```

## Implementación en un formulario de creación de contenido

```jsx
const [content, setContent] = useState({
  title: '',
  summary: '',
  body: ''
});

const [errors, setErrors] = useState({
  title: '',
  summary: '',
  body: ''
});

const handleChange = (e) => {
  const { name, value } = e.target;
  setContent(prev => ({
    ...prev,
    [name]: value
  }));
};

const validateContentLength = (name, value) => {
  if (name === 'summary' && value.length > 200) {
    return 'El resumen no debe exceder los 200 caracteres';
  }
  if (name === 'body' && value.length < 100) {
    return 'El contenido debe tener al menos 100 caracteres';
  }
  return '';
};

const handleBlur = (e) => {
  const { name, value } = e.target;
  const error = validateContentLength(name, value);
  
  setErrors(prev => ({
    ...prev,
    [name]: error
  }));
};

// ...

<form className="content-form">
  <CustomInput 
    label="Título"
    name="title"
    value={content.title}
    onChange={handleChange}
    required={true}
    error={errors.title}
  />
  
  <CustomTextarea 
    label="Resumen"
    name="summary"
    value={content.summary}
    onChange={handleChange}
    onBlur={handleBlur}
    rows={3}
    maxLength={200}
    error={errors.summary}
  />
  
  <CustomTextarea 
    label="Contenido"
    name="body"
    value={content.body}
    onChange={handleChange}
    onBlur={handleBlur}
    rows={10}
    required={true}
    error={errors.body}
  />
  
  <PrimaryButton type="submit">Publicar</PrimaryButton>
</form>
``` 