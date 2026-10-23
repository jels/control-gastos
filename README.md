# Control de Gastos

Aplicación web para registrar y compartir las entradas y salidas de dinero de un hogar.

Dos personas pueden iniciar sesión con correo y contraseña y ver el mismo historial. Cada movimiento guarda quién lo cargó.

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
2. Habilitá en Firebase Authentication: **Email/Password**. Google es opcional y la pantalla de login actual no lo muestra.
3. Creá en Firestore el documento `config/access` con el campo `allowedEmails` (array) y los correos autorizados. La app lo valida antes de pedir la contraseña.
4. Publicá las reglas de `firestore.rules`. Exigen que el correo esté verificado y autorizado.
5. Seguí la guía completa: **[docs/FIREBASE.md](docs/FIREBASE.md)**.

La guía explica cómo:

- Crear el proyecto Firebase.
- Habilitar el acceso con correo y contraseña.
- Verificar el correo de cada cuenta nueva.
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

Pueden leer y escribir los UID incluidos en `households/{householdId}.members` y los emails verificados incluidos en `memberEmails`. La configuración está en `src/environments/environment.ts` (`householdId: 'casa'`).

## Notas

- **Login en dos pasos:** primero solo el correo y **Ingresar**. La app valida que esté en `config/access.allowedEmails`; si no está, no avanza. Si está autorizado y tiene contraseña, aparece el correo bloqueado, el campo **Contraseña** y **Ingresar** / **Usar otra cuenta**. Si no tiene contraseña, aparece **Asignar contraseña**. **Usar otra cuenta** cierra la sesión y vuelve al inicio vacío.
- **Verificación de correo:** al asignar una contraseña, Firebase envía un enlace de verificación. Hasta abrirlo, las reglas de Firestore bloquean el acceso. La app muestra **Ya verifiqué** y **Reenviar correo**.
- **La contraseña no se guarda en Firestore**: Firebase Authentication la almacena hasheada. En `usuarios/{uid}` se guarda el perfil (email, nombre, proveedor, `passwordSet`, `emailVerified`, `householdId` y último acceso), nunca la contraseña. La colección `acceso/{email}` solo indica si el correo ya tiene contraseña para poder decidir el paso del login.
- **Lista de acceso global:** solo los emails de `config/access.allowedEmails` pueden usar la app. Se valida antes de pedir la contraseña y se vuelve a validar después del login; las reglas también bloquean los datos al resto. La app también consulta `acceso/{email}` para saber si ya hay contraseña.
- **Primer ingreso y hogar:** la primera cuenta autorizada y verificada crea `households/casa` automáticamente. Para sumar a otra persona, agregá su email a `config/access.allowedEmails`; si hay lugar, la app la suma al hogar sola.
- **Optimus UI es MIT**: no requiere licencia, registro ni clave. Es la alternativa comunitaria compatible con la API de PrimeNG 22.
- **AngularFire no está instalado**: su versión estable apunta a Angular 20 y todavía no hay una estable para Angular 22. La integración usa `firebase/app`, `firebase/auth` y `firebase/firestore`.
- **PrimeFlex** se mantiene para las clases utilitarias. Optimus UI recomienda Tailwind; la migración es opcional con `ng generate @openng/optimus-ui:migrate-from-primeflex`.
- Los datos se guardan en Firestore, no en `localStorage`.
- La app mantiene una caché offline de Firestore y sincroniza al recuperar conexión.
