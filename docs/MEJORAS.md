# Análisis y próximas mejoras

## Estado actual

La app pasó de un prototipo con login hardcodeado y un backend externo a un stack estable con:

- Angular 22.2 + TypeScript 6.0.
- Optimus UI 2.0.2 (MIT) con tema Aura, sin licencia ni registro.
- Firebase 13: Authentication + Firestore.
- Datos compartidos por hogar y protegidos con reglas de Firestore.
- Build de producción y test unitario funcionando con Vitest 5.
- `npm audit`: 0 vulnerabilidades conocidas.

## Correcciones aplicadas

| Problema | Estado |
|---|---|
| Contraseñas en texto plano dentro del bundle | Resuelto con Firebase Authentication. |
| Login con usuario/contraseña | Reemplazado por Google Sign-In. |
| Popup de Google bloqueado en móvil | Redirect automático en celular/PWA y enlace mágico por email como alternativa. |
| Acceso de cualquier cuenta de Google | Lista global `config/access.allowedEmails`; el resto se desloguea y las reglas le bloquean los datos. |
| Configuración manual inicial del hogar | La primera cuenta crea `households/casa`; la segunda se agrega por email/UID. |
| Dependencia de un backend externo en Render | Reemplazado por Firestore. |
| Todos los datos eran globales | Ahora se aíslan por `households/{id}` y reglas de miembros. |
| `localStorage` solo guardaba el nombre de usuario | La sesión ahora la gestiona Firebase Auth. |
| Fechas `yyyy-MM-dd` con corrimiento por UTC | Se interpretan como medianoche local. |
| CSV con posible inyección de fórmulas | Se escapan celdas peligrosas. |
| Importación JSON sin validación | Se validan tipo, monto y categoría. |
| Sin caché offline | Firestore usa caché persistente multi-pestaña. |
| PrimeNG 17 con Angular 20 y `legacy-peer-deps` | Migrado a Optimus UI 2 + Angular 22, sin workaround ni licencia. |
| PrimeNG 22 con licencia comercial | Reemplazado por Optimus UI 2.0.2 (MIT, sin registro). |
| Karma/Jasmine con dependencias vulnerables | Migrado a Vitest 5 + jsdom. |
| Sin tests | Hay un test base del shell de la app. |

## Prioridades siguientes

### 1. Tiempo real entre los dos usuarios

Hoy el dashboard carga una vez y se refresca con el botón. Para un hogar, lo ideal es que cuando uno carga un gasto, el otro lo vea al instante.

- Usar `onSnapshot` de Firestore en `StorageService`.
- Exponer un observable o callback y desuscribirse en `ngOnDestroy`.
- Mantener la carga inicial y los totales actualizados con cada snapshot.

### 2. Editar y eliminar movimientos individuales

Actualmente solo se puede borrar todo el historial.

- Agregar acciones por fila: editar y eliminar.
- Confirmar la eliminación con `ConfirmationService`.
- Validar que el usuario siga siendo miembro del hogar en las reglas.

### 3. Filtros y resumen mensual

- Filtrar por mes, categoría, tipo y usuario.
- Mostrar totales del mes seleccionado.
- Agregar un gráfico de gastos por categoría.
- Considerar `p-chart` (Optimus UI lo mantiene como deprecado) o una librería de gráficos mantenida.

### 4. Onboarding del hogar

Hoy la primera cuenta crea el hogar automáticamente, pero la segunda se agrega a mano en Firestore.

- Agregar una pantalla para invitar al segundo miembro desde la app.
- Permitir unirse con un código de invitación o aprobación del dueño.
- Diseñar reglas que permitan unirse solo con una invitación válida.

### 5. Seguridad adicional

- Activar **Firebase App Check**.
- Evaluar verificación de email.
- Agregar límites de uso y monitoreo de errores (Sentry o similar).
- Revisar periódicamente las reglas con el simulador de Firestore.

### 6. Experiencia offline y PWA

- Convertir la app en PWA instalable.
- Mostrar un indicador claro de “sin conexión” y de escrituras pendientes.
- Probar conflictos cuando ambos usuarios editan el mismo registro.

### 7. Calidad y CI/CD

- Agregar tests de `StorageService` (conversión de fechas, CSV, importación).
- Agregar tests de `AuthService` con mocks de Firebase.
- Incorporar Playwright para flujos E2E (login, alta de gasto, importación).
- Configurar GitHub Actions o el CI de Netlify para ejecutar build + tests.
- Automatizar `npm audit` y actualizaciones con Dependabot/Renovate.

### 8. Theming de Optimus UI

- Optimus UI es MIT: no requiere licencia ni registro.
- Evaluar un preset propio (colores, tipografía) usando `definePreset` con `provideOptimus`.
- Opcional: migrar PrimeFlex a Tailwind con `ng generate @openng/optimus-ui:migrate-from-primeflex`.
- Revisar el tamaño del bundle: Firebase + Optimus UI ronda los 2.3 MB sin comprimir.
## Notas de arquitectura

- Los servicios usan el SDK modular de Firebase con `InjectionToken`, lo que mantiene el código testeable y desacoplado de AngularFire.
- `StorageService` centraliza fechas, CSV, importación y lotes de Firestore.
- `firestore.rules` es la única fuente de verdad para permisos; el frontend no debe considerarse confiable.
- El `householdId` está en el environment para que el mismo build pueda apuntar a otro hogar cambiando solo la configuración.
