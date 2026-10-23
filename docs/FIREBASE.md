# Conexión con Firebase

Esta app usa:

- **Angular 22.2** con componentes standalone.
- **Optimus UI 2.0.2** (MIT) para la interfaz.
- **Firebase Authentication** con correo y contraseña (Google queda opcional).
- **Cloud Firestore** como base de datos.
- El **SDK modular de Firebase 13 directamente**, sin `@angular/fire`.

> ¿Por qué sin AngularFire? La versión estable de `@angular/fire` todavía apunta a Angular 20 y no hay una versión estable para Angular 22. La integración se hace con los paquetes oficiales `firebase/app`, `firebase/auth` y `firebase/firestore`.

---

## 1. Arquitectura de datos

```text
usuarios/
  {uid}/                        ← perfil del usuario (sin contraseña)
    email: string
    displayName: string
    provider: "password" | "google.com"
    lastLogin: Timestamp

households/
  casa/                         ← documento del hogar
    name: "Casa"
    ownerUid: "UID_DEL_PRIMER_USUARIO"
    members: ["UID_ESPOSO", "UID_ESPOSA"]
    memberEmails: ["esposo@gmail.com", "esposa@gmail.com"]
    createdAt: Timestamp
    gastos/
      {gastoId}/
        fecha: Timestamp
        tipoOperacion: "entrada" | "salida"
        categoria: string
        monto: number
        usuario: string
        fechaRegistro: Timestamp
```

- `usuarios/{uid}` guarda el perfil. **La contraseña no se guarda en Firestore**; Firebase Auth la almacena hasheada.
- `households/casa` define **quién pertenece al hogar**.
- Los gastos viven en la subcolección `gastos`.
- `firestore.rules` permite leer/escribir si el UID está en `members` o el email verificado está en `memberEmails`.
- El ID `casa` se configura en `src/environments/environment.ts` con `householdId`.

Si querés otro ID (por ejemplo `hogar`), cambiá el ID del documento en Firestore y el valor de `householdId` en los dos archivos de environment.

---

## 2. Requisitos

- **Node.js** `^22.22.3`, `^24.15.0` o `>=26.0.0`.
- **npm 11** o superior.
- Una cuenta de Google para Firebase.
- **Optimus UI es MIT**: no requiere licencia, registro ni clave.

Comprobá las versiones:

```bash
node --version
npm --version
```

---

## 3. Crear el proyecto en Firebase

1. Entrá a <https://console.firebase.google.com/>.
2. Hacé clic en **Agregar proyecto**.
3. Elegí un nombre (por ejemplo `control-gastos`).
4. Google Analytics es opcional; para esta app no es necesario.
5. Creá el proyecto.

---

## 4. Registrar la app web y obtener la configuración

1. En la pantalla principal del proyecto, hacé clic en el ícono **`</>`** (Web).
2. Poné un nombre, por ejemplo `control-gastos-web`.
3. **No** marques Firebase Hosting por ahora (la app se puede seguir publicando en Netlify).
4. Firebase te muestra un objeto parecido a este:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "control-gastos-xxxx.firebaseapp.com",
  projectId: "control-gastos-xxxx",
  storageBucket: "control-gastos-xxxx.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

5. Copiá esos valores en `src/environments/firebase.config.ts`:

```ts
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIza...',
  authDomain: 'control-gastos-xxxx.firebaseapp.com',
  projectId: 'control-gastos-xxxx',
  storageBucket: 'control-gastos-xxxx.firebasestorage.app',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456',
};
```

> Este archivo se comparte entre desarrollo y producción. No hace falta duplicar la configuración.
>
> **Importante:** estos valores no son secretos. Es normal que viajen en el JavaScript del navegador. La seguridad real la aplican las reglas de Firestore y Firebase Authentication.

---

## 5. Habilitar Email/Password

1. En Firebase Console, andá a **Compilación → Authentication**.
2. Hacé clic en **Comenzar**.
3. En **Sign-in method**, habilitá **Email/Password**.
4. En **Authentication → Settings → Authorized domains**, verificá que estén:
   - `localhost`
   - tu dominio de Netlify (cuando publiques la app)
5. Opcional pero recomendado para el flujo exacto: en **Authentication → Settings → User actions**, deshabilitá **Email enumeration protection**. Eso permite que la app consulte si un correo ya tiene contraseña.

> La pantalla de login muestra **solo correo y contraseña**. Google puede quedar habilitado en Firebase, pero no se muestra en la UI.
>
> **Las cuentas con contraseña deben verificar el correo.** Al asignar la contraseña, Firebase envía un enlace de verificación. Hasta que se abra ese enlace, las reglas de Firestore bloquean el acceso. En la app aparece la pantalla **“Verificá tu correo”** con las opciones **Ya verifiqué** y **Reenviar correo**.
>
> Si **Email enumeration protection** queda activada, la app no puede saber si el correo existe antes del primer intento. En ese caso muestra igual el campo de contraseña y agrega la opción **Asignar contraseña** como fallback.
>
> Para probar en el celular, abrí la app desde el dominio de Netlify (no desde `localhost`, que en el teléfono apunta al propio teléfono) y agregá ese dominio en **Authentication → Settings → Authorized domains**.
>
> **Antes de publicar las reglas**, creá la lista de acceso `config/access` (paso 6). Sin ese documento, nadie puede usar la app.

---

## 6. Lista de acceso y cuentas

### Lista global de acceso

En Firestore, creá este documento:

```text
config/access
  allowedEmails: ["jels1991@gmail.com", "otra-persona@gmail.com"]
```

- Colección: `config`
- Documento: `access`
- Campo: `allowedEmails` (tipo **array** de strings)
- Valores: los emails autorizados que pueden usar la app.

La app lee este documento después de verificar el correo. Si el email no está en la lista, **cierra la sesión inmediatamente** y muestra “Esta cuenta no está autorizada”.

Las reglas de Firestore también exigen que el email esté en `allowedEmails` para leer o escribir cualquier dato. Así, aunque alguien intente saltarse el frontend, no puede acceder a Firestore.

> Si Firestore todavía no existe, crealo primero en el paso 7 y volvé a este paso.

### Cuentas y hogar

No hace falta crear usuarios a mano. La primera vez que alguien asigna una contraseña con **“Asignar contraseña”**, Firebase crea la cuenta automáticamente y envía el correo de verificación.

Para que la primera cuenta pueda crear el hogar, su email tiene que estar en `config/access.allowedEmails` y tiene que estar verificado.

- La **primera cuenta autorizada y verificada** que entra crea `households/casa` con su UID y su email.
- Para sumar a la **segunda persona**:
  1. Agregá su email a `config/access.allowedEmails`.
  2. Iniciá sesión con la segunda cuenta: correo, **Ingresar** y **Asignar contraseña** si es la primera vez.
  3. Verificá el correo desde el enlace que llega a su buzón.
  4. Si el hogar tiene menos de 2 miembros, la app intenta sumarla automáticamente.
  5. Si no puede, la app muestra el email y el UID. Agregá el email a `memberEmails` o el UID a `members` en `households/casa`.

La forma más simple es usar `memberEmails`. El UID se puede copiar desde **Authentication → Users** o desde la pantalla de acceso denegado de la app.

### Perfil de usuario y contraseña

En `usuarios/{uid}` se guarda el perfil:

```text
usuarios/{uid}
  email: string
  displayName: string
  provider: "password" | "google.com"
  lastLogin: Timestamp
```

**La contraseña no se guarda en Firestore.** Firebase Authentication la almacena hasheada y no se puede leer. Guardar contraseñas en la base sería un riesgo de seguridad y no es necesario.

### Verificación del correo

Firebase marca `email_verified = false` cuando se crea una cuenta con contraseña. Las reglas exigen `email_verified = true`, así que el primer ingreso tiene dos partes:

1. Asignar la contraseña.
2. Abrir el enlace que Firebase envía al correo.

Después de abrir el enlace, volvé a la app y tocá **“Ya verifiqué”**. La app recarga la cuenta, fuerza un token nuevo y recién ahí permite entrar a Firestore.

Si el correo no llega:

- Revisá spam o correo no deseado.
- Usá **“Reenviar correo”** en la pantalla de verificación.
- Verificá que el email esté bien escrito.

### Si ya entraste con Google y no tenés contraseña

Firebase crea la cuenta con el proveedor Google, pero **sin contraseña**. En ese caso:

1. En Firebase Console, andá a **Authentication → Users**.
2. Buscá el correo y eliminá ese usuario de Google.
3. En la app, volvé a empezar con el mismo correo y usá **“Asignar contraseña”**.
4. Abrí el enlace de verificación que llega al correo.
5. La membresía por email en `households/casa.memberEmails` se mantiene; si no está, agregala manualmente.
6. Si el hogar ya tenía 2 miembros, reemplazá el UID viejo por el UID nuevo en `members`. El UID cambia al eliminar y recrear el usuario.

No se puede asignar contraseña a una cuenta que solo tiene Google desde el cliente. Por eso hay que eliminar y recrear el usuario. La app no expone el flujo de vincular Google con contraseña.

Si olvidaste la contraseña, un administrador puede enviarte un restablecimiento desde **Authentication → Users → Restablecer contraseña** en Firebase Console.

---

## 7. Crear la base de datos Firestore

1. En Firebase Console, andá a **Compilación → Firestore Database**.
2. Hacé clic en **Crear base de datos**.
3. Elegí una ubicación. Para Paraguay, la más cercana suele ser **`southamerica-east1` (São Paulo)**.
   - La ubicación **no se puede cambiar** después.
4. Elegí **Modo de producción**.
   - Las reglas todavía no están publicadas; las desplegamos en el paso 9.

---

## 8. Documento del hogar (se crea solo)

La primera cuenta autorizada en `config/access.allowedEmails` que asigna una contraseña y verifica su correo crea automáticamente este documento:

```text
households/casa
  name: "Casa"
  ownerUid: "UID_DEL_PRIMER_USUARIO"
  members: ["UID_DEL_PRIMER_USUARIO"]
  memberEmails: ["email@gmail.com"]
  createdAt: timestamp
```

Para sumar a la segunda persona, agregá su email a `config/access.allowedEmails`; si el hogar tiene menos de 2 miembros, la app la suma automáticamente. También podés editar `memberEmails` (recomendado) o `members` manualmente desde **Firestore Database → Datos**. No borres `ownerUid` ni `createdAt`.

> Si el documento ya existe de la versión anterior, la app no lo vuelve a crear. Solo tenés que agregar el email o UID de las cuentas a `memberEmails`/`members`.

---

## 9. Publicar las reglas de Firestore

### Opción A: con Firebase CLI (recomendado)

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Elegí tu proyecto y poné el alias `default`. Eso actualiza `.firebaserc` (que por defecto tiene `TU_PROYECTO`).

Después:

```bash
firebase deploy --only firestore:rules
```

### Opción B: desde la consola

1. Abrí `firestore.rules` en el proyecto.
2. Copiá todo el contenido.
3. En Firebase Console, andá a **Firestore Database → Reglas**.
4. Pegá las reglas y hacé clic en **Publicar**.

Las reglas hacen lo siguiente:

- Exigen usuario autenticado con email verificado (Google o correo/contraseña).
- Exigen que el email esté en `config/access.allowedEmails`.
- Permiten crear el hogar solo si el hogar no existe.
- Permiten que un email autorizado se sume a sí mismo si hay lugar (máximo 2 miembros).
- Permiten leer/escribir si el UID está en `members` o el email verificado está en `memberEmails`.
- Validan los campos de cada gasto.
- Bloquean cualquier acceso no listado explícitamente.

---

## 10. Interfaz de usuario: Optimus UI

La interfaz usa **Optimus UI 2.0.2**, una librería comunitaria con licencia **MIT**, compatible con la API de PrimeNG 22.

- **No requiere registro, licencia ni clave.**
- Usa el tema **Aura** mediante `provideOptimus` en `src/app/app.config.ts`.
- Los iconos vienen de `@openng/icons` y mantienen las clases `pi pi-*`.
- **PrimeFlex 4** se mantiene para las clases utilitarias (`flex`, `grid`, `gap-*`, etc.).

Si partís de un proyecto con PrimeNG 21, la migración a Optimus UI se hace con:

```bash
npm install @openng/optimus-ui@2
ng generate @openng/optimus-ui:migrate-from-primeng
```

> Optimus UI recomienda Tailwind CSS en lugar de PrimeFlex. La migración es opcional:
> `ng generate @openng/optimus-ui:migrate-from-primeflex`. Por ahora la app conserva PrimeFlex para no reescribir todo el layout.

---

## 11. Ejecutar y probar

```bash
npm install
npm start
```

Abrí <http://localhost:4200>. El login es en dos pasos:

1. Escribí tu correo y hacé clic en **Ingresar**.
2. Si el correo ya tiene contraseña, la app muestra el correo bloqueado, el campo **Contraseña** y los botones **Ingresar** / **Usar otra cuenta**.
3. Si es la primera vez, aparece el campo de contraseña y el botón **Asignar contraseña**.
4. Después de asignar la contraseña, abrí el enlace de verificación que llega al correo y tocá **Ya verifiqué** en la app.
5. **Usar otra cuenta** vuelve al inicio con el correo vacío y sin sesión.

Si **Email enumeration protection** está activada, la app no puede saber de antemano si el correo tiene contraseña; muestra el campo de contraseña con la opción **Asignar contraseña** como fallback.

- La primera vez, la app crea `households/casa` automáticamente.
- Si aparece “Tu cuenta no tiene acceso al hogar”, seguí el paso 6 para agregar tu email al hogar.

Para verificar que los datos se guardan:

1. Cargá un movimiento desde la app.
2. En Firebase Console, andá a **Firestore Database**.
3. Abrí `households → casa → gastos`.
4. Deberías ver el documento con `monto`, `categoria`, `usuario`, etc.

Comandos útiles:

```bash
npm run build   # build de producción
npm test        # tests con Vitest
```

---

## 12. Publicar en Netlify

El proyecto ya tiene `netlify.toml`:

```toml
[build]
  command = "ng build --configuration production"
  publish = "dist/control-gastos/browser"
```

La configuración de Firebase se compila dentro del bundle, así que no hay variables de entorno adicionales en Netlify.

Recomendaciones:

- Configurá Netlify con Node 22.22.3+, 24.15+ o 26.
- Agregá el dominio de Netlify en **Authentication → Settings → Authorized domains**.
- Mantené las reglas de Firestore publicadas en el proyecto correcto.
- No subas claves de servicio (`serviceAccountKey.json`) al repositorio.

---

## 13. Emuladores locales (opcional)

Para desarrollar sin tocar la base real:

```bash
firebase emulators:start
```

Después, en `src/environments/environment.development.ts`:

```ts
useEmulators: true,
```

La app se conecta a:

- Auth: `http://127.0.0.1:9099`
- Firestore: `127.0.0.1:8080`
- UI: `http://127.0.0.1:4000`

En la UI del emulador tenés que crear los usuarios y el documento `households/casa` igual que en producción.

Para volver a la base real, poné `useEmulators: false`.

---

## 14. Cómo acceder a los datos

### Desde la app

Ya está conectada: lee y escribe en `households/{householdId}/gastos` usando el SDK de Firebase.

### Desde Firebase Console

**Firestore Database → Datos**. Es la forma más rápida de revisar o corregir registros manualmente.

### Desde un script o backend con Firebase Admin SDK

1. En Firebase Console, andá a **Configuración del proyecto → Cuentas de servicio**.
2. Hacé clic en **Generar nueva clave privada**.
3. Guardá el archivo JSON **fuera del repositorio** o en una ruta ignorada por Git.
4. Instalá el SDK:

```bash
npm install firebase-admin
```

5. Ejemplo de lectura:

```js
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);
const snapshot = await db
  .collection('households')
  .doc('casa')
  .collection('gastos')
  .orderBy('fecha', 'desc')
  .get();

for (const doc of snapshot.docs) {
  console.log(doc.id, doc.data());
}
```

> La clave de servicio da acceso total al proyecto. Nunca la pongas en `src/`, en el frontend ni en el repositorio.

### Desde otra app o integración

Podés usar la API REST de Firestore con un ID token de un usuario autenticado, o el Admin SDK desde un backend. Para este proyecto, la app Angular ya cubre el caso de uso principal.

---

## 15. Migrar los datos del backend anterior

La app anterior usaba:

```text
https://backend-gastos-nkl5.onrender.com/api/gastos
```

Para migrar:

1. Abrí esa URL en el navegador (o usá `curl`) y guardá la respuesta como `gastos.json`.
2. Verificá que sea un arreglo de objetos con `fecha`, `tipoOperacion`, `categoria`, `monto`, `usuario` y `fechaRegistro`.
3. En la app, usá el botón de **Importar JSON** (ícono de subida).
4. La importación escribe en Firestore en lotes de 500 y conserva los IDs originales, así que repetirla no duplica registros.
5. Los gastos quedan asociados al hogar existente. Para entrar con las cuentas nuevas, agregá sus emails a `memberEmails` o sus UID a `members` en `households/casa`.

---

## 16. Plan gratuito y costos

Para dos personas, el plan gratuito **Spark** de Firestore suele ser más que suficiente. Al momento de escribir esto incluye, aproximadamente:

- 1 GiB de almacenamiento.
- 50.000 lecturas de documentos por día.
- 20.000 escrituras por día.
- 20.000 eliminaciones por día.

Cada operación sobre `gastos` también hace una lectura de `households/casa` por las reglas de seguridad. Aun así, el volumen de un hogar es muy bajo.

Verificá los límites actuales en <https://firebase.google.com/pricing>.

---

## 17. Problemas frecuentes

| Error | Causa probable | Solución |
|---|---|---|
| `auth/api-key-not-valid` | Configuración incorrecta o incompleta | Revisá `src/environments/firebase.config.ts` |
| `auth/operation-not-allowed` | El proveedor no está habilitado | Authentication → Sign-in method → Email/Password |
| `auth/unauthorized-domain` | El dominio no está autorizado | Authentication → Settings → Authorized domains |
| `auth/invalid-credential` o `auth/wrong-password` | Correo o contraseña incorrectos, o la cuenta todavía no tiene contraseña | Usá **Ingresar** si ya la tenés; si es tu primera vez, volvé al inicio y usá **Asignar contraseña** |
| `auth/email-already-in-use` | El correo ya tiene una cuenta (puede ser de Google, sin contraseña) | Si es una cuenta de Google, eliminá el usuario en Authentication → Users y volvé a asignar la contraseña |
| `auth/weak-password` | La contraseña tiene menos de 6 caracteres | Usá al menos 6 caracteres |
| `auth/user-not-found` | No existe cuenta con ese correo | Volvé al inicio y usá **Asignar contraseña** |
| `auth/too-many-requests` | Demasiados intentos o envíos de correo | Esperá unos minutos y volvé a intentar |
| No llega el correo de verificación | Spam, correo mal escrito o límite de envíos | Revisá spam, verificá el email y usá **Reenviar correo** |
| La app dice “Verificá tu correo” después de asignar la contraseña | La cuenta todavía no abrió el enlace de verificación | Abrí el enlace, volvé a la app y tocá **Ya verifiqué** |
| La app dice “No se pudo verificar si el correo ya tiene contraseña” | **Email enumeration protection** está activada | Deshabilitala en Authentication → Settings → User actions, o usá **Asignar contraseña** como fallback |
| Olvidé mi contraseña | No hay recuperación automática en la UI | Un administrador puede enviar el restablecimiento desde Authentication → Users → Restablecer contraseña |
| `permission-denied` | El email no está verificado, no está en `config/access.allowedEmails`, no es miembro del hogar o las reglas no se publicaron | Verificá el correo, revisá el paso 6 y publicá las reglas del paso 9 |
| `Missing or insufficient permissions` | Igual que el anterior | Revisá la lista de acceso, miembros y reglas |
| La app muestra “Esta cuenta no está autorizada” | El email no está en `config/access.allowedEmails` | Agregalo en Firestore y volvé a iniciar sesión |
| La app muestra “Tu cuenta no tiene acceso al hogar” | El email no está en `memberEmails` y el UID no está en `members` | Agregá uno de los dos en `households/casa` |
| La primera cuenta no puede crear el hogar | Su email no está en `config/access.allowedEmails` o las reglas no se publicaron | Agregalo en Firestore, publicá las reglas y volvé a intentar |
| La app dice “Firebase no está configurado” | Los valores siguen siendo `TU_...` | Pegá la configuración real |
| Los datos no aparecen en la consola | Proyecto equivocado o `projectId` incorrecto | Verificá el proyecto seleccionado en Firebase Console |
| `unavailable` | Sin conexión | Firestore usa caché local y sincroniza al volver |

---

## 18. Seguridad: lo importante

- La configuración web de Firebase es pública. No la trates como un secreto.
- La seguridad real está en `firestore.rules`: primero se exige que el email esté verificado y en `config/access.allowedEmails`; después, que pertenezca al hogar (`members` o `memberEmails`).
- **Las contraseñas las gestiona Firebase Authentication.** Se guardan hasheadas y no se pueden leer. En Firestore solo se guarda el perfil (`usuarios/{uid}`), nunca la contraseña.
- **El correo debe estar verificado.** Las reglas exigen `email_verified = true` para leer o escribir datos. Eso evita que alguien cree una cuenta con el correo de otra persona sin acceso a ese buzón.
- Los UID y emails se administran desde Firebase Console o con el Admin SDK, nunca desde el cliente.
- La lista global de acceso se edita en `config/access.allowedEmails` desde Firestore Console.
- No guardes `serviceAccountKey.json` ni claves privadas en el repositorio.
- Si una cuenta se ve comprometida, quitá su email/UID del hogar, cambiá su contraseña o deshabilitá el usuario en **Authentication → Users**.
- Revisá periódicamente **Authentication → Users**: las cuentas con contraseña deben figurar con el email verificado.
- Para producción, considerá activar **Firebase App Check** y límites de uso.
- Optimus UI y @openng/icons son MIT: no hay claves de licencia que proteger.
