# Componente CustomInput

Un componente de entrada de texto personalizado con soporte para diversos tipos de datos, estados, validación y elementos visuales.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| type | 'text' \| 'password' \| 'email' \| 'number' \| 'tel' \| 'search' \| 'url' | 'text' | Tipo de entrada |
| name | string | undefined | Nombre del campo de entrada |
| label | string | undefined | Etiqueta descriptiva del campo |
| value | string \| number | undefined | Valor actual del campo |
| placeholder | string | undefined | Texto de ayuda mostrado cuando el campo está vacío |
| onChange | (e: ChangeEvent<HTMLInputElement>) => void | undefined | Función que se ejecuta al cambiar el valor |
| onBlur | (e: FocusEvent<HTMLInputElement>) => void | undefined | Función que se ejecuta cuando el campo pierde el foco |
| onFocus | (e: FocusEvent<HTMLInputElement>) => void | undefined | Función que se ejecuta cuando el campo recibe el foco |
| required | boolean | false | Indica si el campo es obligatorio |
| disabled | boolean | false | Deshabilita la interacción con el campo |
| error | string | undefined | Mensaje de error a mostrar debajo del campo |
| className | string | '' | Clases CSS adicionales |
| autoComplete | string | undefined | Comportamiento de autocompletado del navegador |
| icon | React.ReactNode | undefined | Icono a mostrar junto al campo |
| maxLength | number | undefined | Número máximo de caracteres permitidos |
| minLength | number | undefined | Número mínimo de caracteres requeridos |
| pattern | string | undefined | Patrón de validación RegExp |
| readOnly | boolean | false | Hace que el campo sea de solo lectura |

## Ejemplos de uso

### Campo de texto básico
```jsx
<CustomInput 
  label="Nombre"
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### Campo de correo electrónico con validación
```jsx
<CustomInput 
  type="email"
  label="Correo electrónico" 
  name="email"
  value={email}
  onChange={handleEmailChange}
  required={true}
  error={emailError}
/>
```

### Campo numérico con icono
```jsx
<CustomInput 
  type="number"
  label="Edad"
  name="age"
  value={age}
  onChange={handleAgeChange}
  icon={<UserIcon />}
/>
```

### Campo de contraseña
```jsx
<CustomInput 
  type="password"
  label="Contraseña"
  name="password"
  value={password}
  onChange={handlePasswordChange}
  minLength={8}
  required={true}
/>
```

### Campo deshabilitado
```jsx
<CustomInput 
  label="ID de usuario"
  name="userId"
  value={userId}
  readOnly={true}
  disabled={true}
/>
```

## Implementación en un formulario de registro

```jsx
const [formData, setFormData] = useState({
  username: '',
  email: '',
  password: ''
});

const [errors, setErrors] = useState({
  username: '',
  email: '',
  password: ''
});

const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData(prev => ({
    ...prev,
    [name]: value
  }));
};

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const handleBlur = (e) => {
  const { name, value } = e.target;
  
  if (name === 'email' && value && !validateEmail(value)) {
    setErrors(prev => ({
      ...prev,
      email: 'Por favor, introduce un correo electrónico válido'
    }));
  } else {
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  }
};

// ...

<form className="registration-form">
  <CustomInput 
    label="Nombre de usuario"
    name="username"
    value={formData.username}
    onChange={handleChange}
    required={true}
    error={errors.username}
    minLength={3}
  />
  
  <CustomInput 
    type="email"
    label="Correo electrónico"
    name="email"
    value={formData.email}
    onChange={handleChange}
    onBlur={handleBlur}
    required={true}
    error={errors.email}
  />
  
  <CustomInput 
    type="password"
    label="Contraseña"
    name="password"
    value={formData.password}
    onChange={handleChange}
    required={true}
    error={errors.password}
    minLength={8}
  />
  
  <PrimaryButton type="submit">Crear cuenta</PrimaryButton>
</form>
``` 