# Análisis y próximas mejoras

## Estado actual

La app pasó de un prototipo con login hardcodeado y un backend externo a un stack estable con:

- Angular 22.2 + TypeScript 6.0.
- Optimus UI 2.0.2 (MIT) con tema Aura, sin licencia ni registro.
- Firebase 13: Authentication + Firestore.
- Datos privados por cuenta y protegidos con reglas de Firestore.
- Login directo con correo y contraseña, con lista de acceso y creación de contraseña en el primer ingreso.
- Identidad visible en el dashboard y en cada gasto (`usuario`, `usuarioUid`, `usuarioEmail`).
- Build de producción y tests unitarios (shell y login) funcionando con Vitest 5.
- `npm audit`: 0 vulnerabilidades conocidas.

## Correcciones aplicadas

| Problema | Estado |
|---|---|
| Contraseñas en texto plano dentro del bundle | Resuelto con Firebase Authentication. |
| Login con usuario/contraseña | Reemplazado por Firebase Authentication con correo y contraseña. |
| Cuentas con contraseña sin correo verificado | No se exige verificación de correo; la autorización es `config/access.allowedEmails`. |
| Correos no autorizados podían llegar al paso de contraseña | Se valida `config/access.allowedEmails` antes de mostrar contraseña o asignación. |
| La vista quedaba en “Verificando...” aunque Firebase ya había respondido | Se fuerza la detección de cambios (`ChangeDetectorRef`) después de las promesas en login y dashboard. |
| Detección de contraseña dependía de Email enumeration protection | Se agregó el índice `acceso/{email}` con `passwordSet`, sin guardar contraseñas ni hashes. |
| Usuarios sin tabla visible | Perfil en `usuarios/{uid}` (email, nombre, proveedor, último acceso); la contraseña queda en Firebase Auth, hasheada. |
| Cuentas creadas con otro proveedor | La app no se conecta con Google ni con otros proveedores; si el correo ya existe, se elimina el usuario en Firebase Console. |
| Acceso de cualquier cuenta | Lista global `config/access.allowedEmails`; el resto se desloguea y las reglas le bloquean los datos. |
| Configuración manual inicial del hogar | Cada cuenta crea su propia `households/{uid}` y solo puede acceder a ella. |
| Dependencia de un backend externo en Render | Reemplazado por Firestore. |
| Todos los datos eran globales | Ahora se aíslan por cuenta en `households/{uid}` y reglas de dueño. |
| `localStorage` solo guardaba el nombre de usuario | La sesión ahora la gestiona Firebase Auth. |
| Fechas `yyyy-MM-dd` con corrimiento por UTC | Se interpretan como medianoche local. |
| CSV con posible inyección de fórmulas | Se escapan celdas peligrosas. |
| Importación JSON sin validación | Se validan tipo, monto y categoría. |
| Sin caché offline | Firestore usa caché persistente multi-pestaña. |
| PrimeNG 17 con Angular 20 y `legacy-peer-deps` | Migrado a Optimus UI 2 + Angular 22, sin workaround ni licencia. |
| PrimeNG 22 con licencia comercial | Reemplazado por Optimus UI 2.0.2 (MIT, sin registro). |
| Karma/Jasmine con dependencias vulnerables | Migrado a Vitest 5 + jsdom. |
| Sin tests | Hay tests del shell y del flujo de login (correo, contraseña y creación de cuenta). |

## Prioridades siguientes

### 1. Tiempo real

Hoy el dashboard carga una vez y se refresca con el botón. Lo ideal es que los cambios aparezcan al instante dentro de la misma cuenta.

- Usar `onSnapshot` de Firestore en `StorageService`.
- Exponer un observable o callback y desuscribirse en `ngOnDestroy`.
- Mantener la carga inicial y los totales actualizados con cada snapshot.

### 2. Editar y eliminar movimientos individuales

Actualmente solo se puede borrar todo el historial.

- Agregar acciones por fila: editar y eliminar.
- Confirmar la eliminación con `ConfirmationService`.
- Validar que el usuario siga siendo dueño de la casa en las reglas.

### 3. Filtros y resumen mensual

- Filtrar por mes, categoría, tipo y usuario.
- Mostrar totales del mes seleccionado.
- Agregar un gráfico de gastos por categoría.
- Considerar `p-chart` (Optimus UI lo mantiene como deprecado) o una librería de gráficos mantenida.

### 4. Perfil y migración

- Permitir editar el nombre visible desde la app.
- Agregar una herramienta para importar los datos de la antigua `households/casa` a la casa de cada cuenta.
- Evaluar un asistente de migración con el Admin SDK.

### 5. Seguridad adicional

- Activar **Firebase App Check**.
- Evaluar agregar verificación de email en el futuro, sin reemplazar la validación de `config/access`.
- Agregar límites de uso y monitoreo de errores (Sentry o similar).
- Revisar periódicamente las reglas con el simulador de Firestore.

### 6. Experiencia offline y PWA

- Convertir la app en PWA instalable.
- Mostrar un indicador claro de “sin conexión” y de escrituras pendientes.
- Probar conflictos cuando se edita el mismo registro desde dos pestañas.

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
- Cada cuenta usa `households/{uid}`; no hay un `householdId` global en el environment.
