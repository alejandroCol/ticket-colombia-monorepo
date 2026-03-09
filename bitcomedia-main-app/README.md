# Ticket Colombia - Aplicación Principal

Aplicación principal de Ticket Colombia desarrollada con React, TypeScript y Vite, centrada en proporcionar una interfaz de usuario moderna y componentes reutilizables.

## Tecnologías

- [React](https://reactjs.org/) - Biblioteca principal de UI
- [TypeScript](https://www.typescriptlang.org/) - Tipado estático para JavaScript
- [Vite](https://vitejs.dev/) - Herramienta de compilación frontend rápida
- [SCSS](https://sass-lang.com/) - Preprocesador CSS para estilos avanzados

## Estructura del Proyecto

La aplicación está organizada siguiendo una arquitectura de componentes reutilizables:

```
src/
├── components/         # Componentes UI reutilizables
│   ├── Chip/           # Etiquetas interactivas
│   ├── PrimaryButton/  # Botones de acción principal
│   ├── SecondaryButton/# Botones de acción secundaria
│   ├── CustomInput/    # Campos de entrada personalizados
│   └── ...             # Otros componentes de la UI
├── assets/             # Recursos estáticos (imágenes, iconos, etc.)
├── styles/             # Estilos globales y variables
└── ...                 # Otros directorios del proyecto
```

## Biblioteca de Componentes

El proyecto incluye una extensa biblioteca de componentes UI reutilizables diseñados para ofrecer una experiencia visual coherente:

- **Botones**: PrimaryButton, SecondaryButton
- **Formularios**: CustomInput, CustomTextarea, CustomSelector, CustomDateTimePicker
- **Elementos UI**: Chip

Cada componente está documentado individualmente con sus propiedades, ejemplos de uso y casos prácticos en su respectivo directorio.

## Desarrollo

Para comenzar a desarrollar:

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
```

## Licencia

Propiedad de Ticket Colombia. Todos los derechos reservados.
