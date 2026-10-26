# Control de Gastos

Aplicación web para registrar entradas y salidas de dinero. **Cada cuenta tiene su propia casa y sus gastos privados**: no se comparten ni se fusionan datos entre correos distintos.

El login valida primero el correo contra una lista de acceso, después pide la contraseña (o la crea si es la primera vez) y muestra claramente qué persona está usando la cuenta. Cada movimiento guarda el nombre, el email y el UID de quien lo cargó.

## Stack

- **Angular 22.2** (standalone components)
- **Optimus UI 2.0.2** + **PrimeFlex 4** + **@openng/icons 1.0.0**
- **Firebase 13**: Authentication + Cloud Firestore
- **SDK modular de Firebase** directamente (sin `@angular/fire`)
- **Vitest 5** para tests unitarios

## Requisitos

- **Node.js** `^22.22.3`, `^24.15.0` o `>=26.0.0`
- **npm 11** o superior

## Configuración rápida

```bash
npm install
npm start
```

Antes de usar la app:

1. Completá `src/environments/firebase.config.ts` con la configuración de tu proyecto Firebase.
2. Habilitá en Firebase Authentication: **Email/Password**.
3. Creá en Firestore el documento `config/access` con el campo `allowedEmails` (array de correos **en minúsculas**). La app lo valida antes de pedir la contraseña.
4. Publicá las reglas de `firestore.rules`. La app necesita que `config/access` se pueda leer puntualmente antes del login.
5. Seguí la guía completa: **[docs/FIREBASE.md](docs/FIREBASE.md)**.

> **Importante:** si el login muestra “No se pudo leer la lista de acceso”, las reglas publicadas no están permitiendo leer `config/access` antes del login. Publicá la versión de `firestore.rules` de este repositorio.

## Flujo de acceso

1. La persona escribe su correo y toca **Ingresar**.
2. La app lee `config/access.allowedEmails`:
   - Si el correo **no está autorizado**, muestra la alerta y no avanza.
   - Si está autorizado, continúa.
3. La app comprueba `acceso/{email}`:
   - Si ya tiene contraseña, muestra el campo **Contraseña**.
   - Si no tiene contraseña, muestra **Crear cuenta e ingresar** para asignarla.
4. Si el correo ya existe en Firebase con otro método de acceso y no tiene contraseña, la app muestra un mensaje para resolverlo desde Firebase Console. No se conecta con Google ni con proveedores externos.
5. Al entrar, el dashboard muestra **“Estás usando la cuenta de …”** y cada gasto queda registrado con el nombre, email y UID de la cuenta.

La contraseña **nunca** se guarda en Firestore: la administra Firebase Authentication. En `acceso/{email}` solo se guarda el estado `passwordSet`.

## Modelo de datos

```text
usuarios/{uid}
  email, displayName, provider, passwordSet, householdId, lastLogin

acceso/{email}
  email, uid, passwordSet, updatedAt

households/{uid}
  name, ownerUid, ownerEmail, createdAt
  gastos/{gastoId}
    fecha, tipoOperacion, categoria, monto,
    usuario, usuarioUid, usuarioEmail, fechaRegistro
```

- `households/{uid}` es privada: el ID es el UID de la cuenta y las reglas solo permiten acceder al dueño.
- No hay `members` ni `memberEmails`: no existe la fusión de gastos entre cuentas.
- `config/access.allowedEmails` es la única lista global de autorización.

## Scripts

```bash
npm start        # servidor de desarrollo en http://localhost:4200
npm run build    # build de producción
npm test         # tests con Vitest
npm run watch    # build en modo watch
```

Para publicar las reglas:

```bash
npm run deploy:rules
```

O, si preferís la CLI directamente:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

O pegá el contenido de `firestore.rules` en **Firebase Console → Firestore Database → Reglas → Publicar**.

## Estructura

```text
src/
  app/
    components/
      dashboard/     # historial privado, totales y carga de movimientos
      login/         # login con correo y contraseña
    guards/          # protección de rutas
    models/          # modelo Gasto
    services/        # AuthService, AccessService, HouseholdService y StorageService
    app.config.ts    # Firebase, Optimus UI y router
    firebase.providers.ts
  environments/
    firebase.config.ts
    environment.ts
    environment.development.ts
firestore.rules      # reglas de seguridad
firestore.indexes.json
firebase.json
```

## Notas

- **Cada cuenta, su casa:** los datos se guardan en `households/{uid}/gastos`. Dos correos distintos no ven ni mezclan sus gastos.
- **Identidad visible:** el dashboard muestra el nombre y el email de la sesión; el gasto guarda `usuario`, `usuarioUid` y `usuarioEmail`.
- **Lista de acceso:** se edita en Firestore, en `config/access.allowedEmails`. Debe contener correos en minúsculas. Es la única validación de acceso: no se usa Google ni verificación por correo.
- **Índice de contraseñas:** `acceso/{email}` permite decidir si hay que pedir contraseña incluso con la protección contra enumeración de emails de Firebase activada. No contiene contraseñas ni hashes.
- **Google:** la app no se conecta con cuentas de Google. Si un correo ya existe en Firebase con otro proveedor, hay que eliminarlo desde **Authentication → Users** para poder crear su contraseña.
- **Datos anteriores:** los documentos de la versión compartida (`households/casa`) no se borran, pero la app nueva ya no los lee. Para conservarlos, exportá un JSON antes de migrar e importalo con el botón **Importar JSON**, o copiá los documentos con el Admin SDK. Ver [docs/FIREBASE.md](docs/FIREBASE.md).
- **Optimus UI es MIT**: no requiere licencia, registro ni clave.
- **AngularFire no está instalado**: su versión estable apunta a Angular 20 y todavía no hay una estable para Angular 22. La integración usa `firebase/app`, `firebase/auth` y `firebase/firestore`.
- Los datos se guardan en Firestore, no en `localStorage`.
- La app mantiene una caché offline de Firestore y sincroniza al recuperar conexión.
