# Roles de administrador

El panel admin soporta dos tipos de rol:

## ADMIN
- Puede crear eventos (se guarda `organizer_id` con su UID).
- **Solo ve y gestiona sus propios eventos** (creados por él).
- No puede ver eventos de otros administradores.
- Puede validar boletos solo de sus eventos.

## SUPER_ADMIN
- Ve y gestiona **todos los eventos** de todos los administradores.
- Útil para supervisión y estadísticas globales.

## Cómo asignar roles

En Firestore, colección `users`, documento con el UID del usuario:

| Campo  | Valor ADMIN   | Valor SUPER_ADMIN |
|--------|---------------|-------------------|
| `role` | `ADMIN`       | `SUPER_ADMIN`     |

**Ejemplo:** Para tener un super admin que vea todos los eventos:
1. Crear el usuario en Firebase Authentication.
2. En Firestore → `users` → documento `{uid}` → campo `role` = `SUPER_ADMIN`.

**Nota:** El rol debe estar en mayúsculas (`ADMIN`, `SUPER_ADMIN`).
