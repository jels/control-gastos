# Control de Gastos

Aplicación web para registrar y compartir las entradas y salidas de dinero de un hogar.

Dos personas pueden iniciar sesión con su cuenta de Google y ver el mismo historial. Cada movimiento guarda quién lo cargó.

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
2. Habilitá el proveedor **Google** en Firebase Authentication.
3. Creá en Firestore el documento `config/access` con el campo `allowedEmails` (array) y los correos autorizados.
4. Seguí la guía completa: **[docs/FIREBASE.md](docs/FIREBASE.md)**.

La guía explica cómo:

- Crear el proyecto Firebase.
- Habilitar Google como método de acceso.
- Crear Firestore y el documento `households/casa` (la primera cuenta lo crea sola).
- Agregar el email de la segunda persona a `memberEmails`.
- Publicar las reglas de seguridad.
- Migrar los datos del backend anterior.
- Acceder a los datos desde la consola o con el Admin SDK.

## Scripts

```bash
npm start        # servidor de desarrollo en http://localhost:4200
npm run build    # build de producción
npm test         # tests con Vitest
npm run watch    # build en modo watch
```

## Estructura

```text
src/
  app/
    components/
      dashboard/     # historial, totales y carga de movimientos
      login/         # login con Firebase Auth
    guards/          # protección de rutas
    models/          # modelo Gasto
    services/        # AuthService y StorageService
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

## Modelo de datos

```text
households/{householdId}/gastos/{gastoId}
```

Solo los UID incluidos en `households/{householdId}.members` pueden leer y escribir. La configuración está en `src/environments/environment.ts` (`householdId: 'casa'`).

## Notas

- **Google en celular:** usa redirect automáticamente (el selector de Google se abre en la misma pestaña). En escritorio usa popup, con redirect como fallback.
- **Lista de acceso global:** solo los emails de `config/access.allowedEmails` pueden usar la app. El resto se desloguea automáticamente y las reglas también le bloquean los datos.
- **Login con Google:** la primera cuenta autorizada crea `households/casa` automáticamente. Para sumar a otra persona, agregá su email a `config/access.allowedEmails`; si hay lugar, la app la suma al hogar sola.
- **Optimus UI es MIT**: no requiere licencia, registro ni clave. Es la alternativa comunitaria compatible con la API de PrimeNG 22.
- **AngularFire no está instalado**: su versión estable apunta a Angular 20 y todavía no hay una estable para Angular 22. La integración usa `firebase/app`, `firebase/auth` y `firebase/firestore`.
- **PrimeFlex** se mantiene para las clases utilitarias. Optimus UI recomienda Tailwind; la migración es opcional con `ng generate @openng/optimus-ui:migrate-from-primeflex`.
- Los datos se guardan en Firestore, no en `localStorage`.
- La app mantiene una caché offline de Firestore y sincroniza al recuperar conexión.
