# Componente CustomDateTimePicker

Un componente de selección de fecha y hora personalizado con múltiples modos y opciones de configuración para capturar valores temporales.

## Propiedades

| Propiedad | Tipo | Predeterminado | Descripción |
|-----------|------|----------------|-------------|
| name | string | undefined | Nombre del campo |
| label | string | undefined | Etiqueta descriptiva del campo |
| value | string | undefined | Valor seleccionado (fecha/hora) |
| onChange | (e: ChangeEvent<HTMLInputElement>) => void | undefined | Función que se ejecuta al cambiar el valor |
| onBlur | (e: FocusEvent<HTMLInputElement>) => void | undefined | Función que se ejecuta cuando el campo pierde el foco |
| onFocus | (e: FocusEvent<HTMLInputElement>) => void | undefined | Función que se ejecuta cuando el campo recibe el foco |
| required | boolean | false | Indica si el campo es obligatorio |
| disabled | boolean | false | Deshabilita la interacción con el campo |
| error | string | undefined | Mensaje de error a mostrar debajo del campo |
| className | string | '' | Clases CSS adicionales |
| icon | React.ReactNode | undefined | Icono a mostrar junto al campo |
| readOnly | boolean | false | Hace que el campo sea de solo lectura |
| min | string | undefined | Fecha/hora mínima seleccionable |
| max | string | undefined | Fecha/hora máxima seleccionable |
| showTime | boolean | false | Muestra selector de fecha y hora combinados |
| timeOnly | boolean | false | Muestra solo el selector de hora |

## Ejemplos de uso

### Selector de fecha básico
```jsx
<CustomDateTimePicker 
  label="Fecha de nacimiento"
  name="birthdate"
  value={birthdate}
  onChange={(e) => setBirthdate(e.target.value)}
/>
```

### Selector de fecha y hora
```jsx
<CustomDateTimePicker 
  label="Fecha y hora del evento" 
  name="eventDateTime"
  value={eventDateTime}
  onChange={handleEventDateTimeChange}
  showTime={true}
/>
```

### Selector de solo hora
```jsx
<CustomDateTimePicker 
  label="Hora de la cita"
  name="appointmentTime"
  value={appointmentTime}
  onChange={handleAppointmentTimeChange}
  timeOnly={true}
/>
```

### Selector con rango limitado
```jsx
<CustomDateTimePicker 
  label="Fecha de reserva"
  name="bookingDate"
  value={bookingDate}
  onChange={handleBookingDateChange}
  min={tomorrow}
  max={threeMonthsFromNow}
  required={true}
/>
```

### Selector deshabilitado
```jsx
<CustomDateTimePicker 
  label="Fecha de creación"
  name="createdAt"
  value={createdAt}
  disabled={true}
/>
```

## Implementación en un formulario de eventos

```jsx
const [event, setEvent] = useState({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  reminderTime: ''
});

// Calcular fechas mínimas y máximas permitidas
const today = new Date().toISOString().split('T')[0];
const nextYear = new Date();
nextYear.setFullYear(nextYear.getFullYear() + 1);
const maxDate = nextYear.toISOString().split('T')[0];

const handleChange = (e) => {
  const { name, value } = e.target;
  setEvent(prev => ({
    ...prev,
    [name]: value
  }));
  
  // Ajustar automáticamente la fecha de finalización si es anterior a la de inicio
  if (name === 'startDate' && event.endDate && value > event.endDate) {
    setEvent(prev => ({
      ...prev,
      endDate: value
    }));
  }
};

// ...

<form className="event-form">
  <CustomInput 
    label="Título del evento"
    name="title"
    value={event.title}
    onChange={handleChange}
    required={true}
  />
  
  <CustomTextarea 
    label="Descripción"
    name="description"
    value={event.description}
    onChange={handleChange}
    rows={3}
  />
  
  <div className="date-time-fields">
    <CustomDateTimePicker 
      label="Fecha de inicio"
      name="startDate"
      value={event.startDate}
      onChange={handleChange}
      showTime={true}
      min={today}
      max={maxDate}
      required={true}
    />
    
    <CustomDateTimePicker 
      label="Fecha de finalización"
      name="endDate"
      value={event.endDate}
      onChange={handleChange}
      showTime={true}
      min={event.startDate || today}
      max={maxDate}
      required={true}
    />
  </div>
  
  <CustomDateTimePicker 
    label="Recordatorio"
    name="reminderTime"
    value={event.reminderTime}
    onChange={handleChange}
    timeOnly={true}
  />
  
  <PrimaryButton type="submit">Crear evento</PrimaryButton>
</form>
``` 