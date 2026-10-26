# Conexión con Firebase

Esta app usa:

- **Angular 22.2** con componentes standalone.
- **Optimus UI 2.0.2** (MIT) para la interfaz.
- **Firebase Authentication** con correo y contraseña. La app no se conecta con Google ni con otros proveedores externos.
- **Cloud Firestore** como base de datos.
- El **SDK modular de Firebase 13 directamente**, sin `@angular/fire`.

> ¿Por qué sin AngularFire? La versión estable de `@angular/fire` todavía apunta a Angular 20 y no hay una versión estable para Angular 22. La integración se hace con los paquetes oficiales `firebase/app`, `firebase/auth` y `firebase/firestore`.

---

## 1. Arquitectura de datos

```text
config/
  access/                     ← lista global de correos autorizados
    allowedEmails: ["jels1991@gmail.com", "otra-persona@gmail.com"]

usuarios/
  {uid}/                      ← perfil del usuario (nunca guarda contraseña)
    email: string
    displayName: string
    provider: "password"
    passwordSet: boolean
    householdId: string       ← es el mismo UID
    lastLogin: Timestamp

acceso/
  {email}/                    ← índice para el login (sin contraseña)
    email: string
    uid: string
    passwordSet: true
    updatedAt: Timestamp

households/
  {uid}/                      ← casa privada de cada cuenta
    name: "Casa de Jonathan"
    ownerUid: "UID_DEL_USUARIO"
    ownerEmail: "usuario@gmail.com"
    createdAt: Timestamp
    gastos/
      {gastoId}/
        fecha: Timestamp
        tipoOperacion: "entrada" | "salida"
        categoria: string
        monto: number
        usuario: string          ← nombre de quien cargó el gasto
        usuarioUid: string       ← UID de la cuenta que lo cargó
        usuarioEmail: string     ← email de la cuenta que lo cargó
        fechaRegistro: Timestamp
```

Puntos importantes:

- **Cada cuenta tiene su propia casa.** El documento es `households/{uid}` y los gastos viven en `households/{uid}/gastos`.
- **No hay miembros compartidos.** No existen `members` ni `memberEmails`. Una cuenta no puede leer ni fusionar los gastos de otra.
- `usuarios/{uid}` guarda el perfil. **La contraseña no se guarda en Firestore**; Firebase Auth la almacena hasheada.
- `acceso/{email}` es un índice mínimo para saber si un correo ya tiene contraseña antes de mostrar el campo. Tampoco guarda la contraseña ni su hash.
- Cada gasto guarda `usuario`, `usuarioUid` y `usuarioEmail` para saber quién lo cargó.
- `config/access.allowedEmails` es la única lista global de autorización. **Los correos deben estar en minúsculas**, porque las reglas los comparan literalmente con el email del token de Firebase.

---

## 2. Requisitos

- **Node.js** `^22.22.3`, `^24.15.0` o `>=26.0.0`.
- **npm 11** o superior.
- Una cuenta para acceder a Firebase Console.
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
4. Analytics es opcional; para esta app no es necesario.
5. Creá el proyecto.

---

## 4. Registrar la app web y obtener la configuración

1. En la pantalla principal del proyecto, hacé clic en el ícono **`</>`** (Web).
2. Poné un nombre, por ejemplo `control-gastos-web`.
3. **No** marques Firebase Hosting por ahora (la app se puede publicar en Netlify).
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

> Estos valores no son secretos. Es normal que viajen en el JavaScript del navegador. La seguridad real la aplican las reglas de Firestore y Firebase Authentication.

---

## 5. Habilitar Email/Password

1. En Firebase Console, andá a **Compilación → Authentication**.
2. Hacé clic en **Comenzar**.
3. En **Sign-in method**, habilitá **Email/Password**. No hace falta habilitar Google ni ningún otro proveedor.
4. En **Authentication → Settings → Authorized domains**, verificá que estén:
   - `localhost`
   - tu dominio de Netlify (cuando publiques la app)
5. Opcional: en **Authentication → Settings → User actions**, podés dejar activada o desactivada la **protección contra enumeración de emails**. La app no depende de esa opción: usa el índice `acceso/{email}` y, si falta, ofrece crear la contraseña.

> La pantalla de login muestra **solo correo y contraseña**. La app no abre ninguna ventana de Google ni valida el correo contra Google.

---

## 6. Lista global de acceso

En Firestore, creá este documento:

```text
config/access
  allowedEmails: ["jels1991@gmail.com", "otra-persona@gmail.com"]
```

- Colección: `config`
- Documento: `access`
- Campo: `allowedEmails` (tipo **array** de strings)
- Valores: los emails autorizados que pueden usar la app. **En minúsculas.**

La app valida este documento **antes de mostrar el campo de contraseña**. Si el correo no está en la lista, no avanza y muestra “Este correo no está autorizado”.

Después del login, la app vuelve a validar el email. Si dejó de estar en la lista, **cierra la sesión inmediatamente**.

Las reglas de Firestore también exigen que el email esté en `allowedEmails` para leer o escribir cualquier dato. Así, aunque alguien intente saltarse el frontend, no puede acceder a Firestore.

> El documento `config/access` se puede leer puntualmente sin sesión para hacer esta primera validación. Solo contiene emails; no guarda contraseñas ni otros datos. La colección no se puede listar y nadie puede escribirla desde la app.
>
> **Muy importante:** las reglas deben permitir `get` sobre `config/access` sin sesión. Si ves un error `403 PERMISSION_DENIED` o “No se pudo leer la lista de acceso”, las reglas publicadas no son las de este repositorio. Publicalas de nuevo siguiendo el paso 8.

---

## 7. Cuentas, casas e identidad

No hace falta crear usuarios a mano.

### Primera vez con un correo autorizado

1. La persona escribe su correo y toca **Ingresar**.
2. La app confirma que está en `config/access.allowedEmails`.
3. Como `acceso/{email}` todavía no existe, muestra **Crear cuenta e ingresar**.
4. Al crear la contraseña, Firebase registra la cuenta, la app guarda `usuarios/{uid}`, `acceso/{email}` y crea `households/{uid}`.
5. La persona entra directamente al dashboard, sin quedar bloqueada esperando verificación.

### Vuelta a entrar

1. La app encuentra `acceso/{email}` con `passwordSet: true`.
2. Muestra el correo bloqueado y el campo **Contraseña**.
3. Al ingresar, Firestore valida la sesión y la pertenencia a la casa.

### Si el correo ya existe en Firebase

Si el correo ya existe en Firebase con otro método de acceso y no tiene contraseña, Firebase devuelve `auth/email-already-in-use`. La app no se conecta con Google ni con otro proveedor: muestra un mensaje para que elimines ese usuario en **Firebase Console → Authentication → Users** y vuelvas a crear la contraseña.

Si el correo ya tiene contraseña, escribila en **Crear cuenta e ingresar** o usá **Ya tengo contraseña**. La app intenta iniciar sesión automáticamente.

### Contraseña olvidada

En el paso de contraseña, usá **Olvidé mi contraseña**. Firebase envía un enlace al correo.

### Identidad visible

- El dashboard muestra **“Estás usando la cuenta de Nombre (email)”**.
- El toolbar muestra el nombre y el email de la sesión.
- Cada gasto guarda `usuario`, `usuarioUid` y `usuarioEmail`.
- La tabla muestra el nombre y, debajo, el email de quien cargó el movimiento.

### Perfil de usuario

En `usuarios/{uid}` se guarda:

```text
usuarios/{uid}
  email: string
  displayName: string
  provider: "password"
  passwordSet: boolean
  householdId: string
  lastLogin: Timestamp
```

**La contraseña no se guarda en Firestore.** Firebase Authentication la almacena hasheada y no se puede leer. Guardar contraseñas o hashes en la base sería un riesgo de seguridad y no es necesario: las reglas de Firestore no pueden validar una contraseña, así que la verificación real siempre la hace Firebase Auth en el servidor.

`passwordSet` es informativo. La autenticación real la valida Firebase Auth.

### Índice de acceso `acceso/{email}`

Cuando una cuenta con contraseña inicia sesión o crea su contraseña, la app crea o actualiza este documento:

```text
acceso/{email}
  email: string
  uid: string
  passwordSet: true
  updatedAt: Timestamp
```

Sirve para que el login sepa si debe pedir contraseña incluso si Firebase tiene activada la protección contra enumeración de emails. Se puede leer puntualmente antes del login y no se puede listar; solo la propia cuenta, autorizada, puede escribir su documento. **No contiene la contraseña ni el hash.**

Si eliminás una cuenta desde **Authentication → Users**, borrá también su documento en `acceso` para que el login no siga mostrando el paso de contraseña.

> **Validación de acceso:** la única validación es `config/access.allowedEmails` más la contraseña de Firebase Authentication. La app no envía enlaces de verificación ni valida el correo con Google.

---

## 8. Publicar las reglas de Firestore

### Opción A: con Firebase CLI (recomendado)

```bash
npm run deploy:rules
```

O directamente:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

Elegí tu proyecto y poné el alias `default`. Eso actualiza `.firebaserc`.

### Opción B: desde la consola

1. Abrí `firestore.rules` en el proyecto.
2. Copiá todo el contenido.
3. En Firebase Console, andá a **Firestore Database → Reglas**.
4. Pegá las reglas y hacé clic en **Publicar**.

Las reglas hacen lo siguiente:

- Permiten leer puntualmente `config/access` antes del login para validar el correo (solo emails).
- Permiten leer puntualmente `acceso/{email}` para saber si ya tiene contraseña (solo estado, sin contraseña).
- Exigen usuario autenticado y email dentro de `config/access.allowedEmails`.
- Permiten crear/leer solo la casa propia: `households/{uid}`.
- Validan que cada gasto pertenezca a la cuenta actual (`usuarioUid` y `usuarioEmail`).
- Bloquean cualquier acceso no listado explícitamente.

> **Si acabás de cambiar `firestore.rules`, tenés que publicarlas.** Los cambios del repositorio no se aplican solos en Firebase.

### Verificar que `config/access` sea legible

Después de publicar, podés comprobar la lectura pública con la API REST de Firestore:

```bash
curl "https://firestore.googleapis.com/v1/projects/TU_PROYECTO/databases/(default)/documents/config/access?key=TU_API_KEY"
```

- Si devuelve el documento con `allowedEmails`, las reglas están bien.
- Si devuelve `403 PERMISSION_DENIED` o `Missing or insufficient permissions`, las reglas publicadas siguen bloqueando la lectura. Volvé a publicar `firestore.rules`.
- Si devuelve `404`, el documento `config/access` no existe.

También revisá **Firebase Console → App Check** si usás App Check: con enforcement activo, las peticiones sin token de App Check también pueden devolver `permission-denied`.

---

## 9. Seguridad: lo importante

- La configuración web de Firebase es pública. No la trates como un secreto.
- `config/access` y `acceso/{email}` se pueden leer puntualmente sin sesión para validar el correo y saber si ya tiene contraseña. Solo contienen emails y estado; no pongas ahí contraseñas, hashes, tokens ni datos sensibles.
- La seguridad real está en `firestore.rules`: primero se exige que el email esté en `config/access.allowedEmails`; después, que la casa sea propia (`households/{uid}`).
- **Las contraseñas las gestiona Firebase Authentication.** Se guardan hasheadas y no se pueden leer. En Firestore solo se guarda el perfil (`usuarios/{uid}`), nunca la contraseña.
- **La única validación de acceso es `config/access.allowedEmails` más la contraseña de Firebase Authentication.** No se exige verificación de email ni se usan proveedores externos. Para un entorno más estricto, creá las cuentas desde Firebase Console o con el Admin SDK.
- Los UID y emails se administran desde Firebase Console o con el Admin SDK, nunca desde el cliente.
- La lista global de acceso se edita en `config/access.allowedEmails` desde Firestore Console, siempre en minúsculas.
- No guardes `serviceAccountKey.json` ni claves privadas en el repositorio.
- Si una cuenta se ve comprometida, quitá su email de `allowedEmails`, cambiá su contraseña o deshabilitá el usuario en **Authentication → Users**.
- Para producción, considerá activar **Firebase App Check** y límites de uso.

---

## 10. Ejecutar y probar

```bash
npm install
npm start
```

Abrí <http://localhost:4200>. El login es en dos pasos:

1. Escribí tu correo y hacé clic en **Ingresar**.
2. La app comprueba que el correo esté en `config/access.allowedEmails`. Si no está, muestra la alerta y no avanza.
3. Si está autorizado y `acceso/{email}` indica que ya tiene contraseña, muestra el correo bloqueado, el campo **Contraseña** y los botones **Ingresar**, **Crear contraseña**, **Olvidé mi contraseña** y **Usar otra cuenta**.
4. Si está autorizado pero no tiene contraseña, aparece el paso **Crear cuenta e ingresar**.
5. Al entrar, el dashboard muestra quién está usando la cuenta y crea `households/{uid}` automáticamente.
6. Cada gasto se guarda en la casa de esa cuenta, con el nombre, email y UID de la sesión.

Si falta el índice `acceso` (por ejemplo, una cuenta creada antes de esta versión), la app no puede saber de antemano si el correo ya tiene contraseña. En ese caso ofrece crear la contraseña; si la cuenta ya existe con contraseña, el intento de creación falla y la app intenta iniciar sesión con la contraseña ingresada. Si la cuenta existe con otro método de acceso, muestra un mensaje para eliminarla en Firebase Console y crear la contraseña.

Comandos útiles:

```bash
npm run build   # build de producción
npm test        # tests con Vitest
```

---

## 11. Publicar en Netlify

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

## 12. Emuladores locales (opcional)

Para desarrollar sin tocar la base real:

```bash
npx firebase-tools emulators:start
```

Después, en `src/environments/environment.development.ts`:

```ts
useEmulators: true,
```

La app se conecta a:

- Auth: `http://127.0.0.1:9099`
- Firestore: `127.0.0.1:8080`
- UI: `http://127.0.0.1:4000`

En la UI del emulador tenés que crear el documento `config/access` y los usuarios igual que en producción.

Para volver a la base real, poné `useEmulators: false`.

---

## 13. Migrar los datos de la versión compartida

La versión anterior guardaba todo en `households/casa` y permitía que dos cuentas compartieran el mismo historial. La versión nueva **no lee ese documento**: cada cuenta usa `households/{uid}`.

Los datos viejos **no se borran**. Tenés tres opciones:

### Opción A: exportar e importar desde la app

1. Con la versión anterior, usá **Descargar JSON** y guardá el archivo.
2. Entrá con la cuenta nueva.
3. Usá **Importar JSON**. Los registros se copian a `households/{uid}/gastos` y conservan el nombre de usuario original; la app agrega el UID y email de la cuenta que importa.

### Opción B: Admin SDK

Con una clave de servicio y `firebase-admin`, copiá los documentos de `households/casa/gastos` a `households/{uid}/gastos` para la cuenta que corresponda. Agregá `usuarioUid` y `usuarioEmail` en cada documento copiado.

### Opción C: empezar de cero

Si no necesitás el historial anterior, no hagas nada. El documento `households/casa` queda intacto en Firestore como respaldo.

---

## 14. Problemas frecuentes

| Error | Causa probable | Solución |
|---|---|---|
| `auth/api-key-not-valid` | Configuración incorrecta o incompleta | Revisá `src/environments/firebase.config.ts` |
| `auth/operation-not-allowed` | El proveedor no está habilitado | Authentication → Sign-in method → Email/Password |
| `auth/unauthorized-domain` | El dominio no está autorizado | Authentication → Settings → Authorized domains |
| “No se pudo leer la lista de acceso” | Las reglas publicadas no permiten leer `config/access` sin sesión | Publicá `firestore.rules` (paso 8) |
| “Este correo no está autorizado” | El email no está en `config/access.allowedEmails` o está con mayúsculas | Agregalo en minúsculas y revisá que el documento exista |
| `auth/invalid-credential` | Correo o contraseña incorrectos, o la cuenta todavía no tiene contraseña | Usá **Crear contraseña** o **Olvidé mi contraseña** |
| `auth/email-already-in-use` | El correo ya existe en Firebase con otro método de acceso y no tiene contraseña | Eliminá ese usuario en **Authentication → Users** y volvé a crear la contraseña. Si ya tenía contraseña, usá **Ya tengo contraseña** o **Olvidé mi contraseña** |
| `auth/weak-password` | La contraseña tiene menos de 6 caracteres | Usá al menos 6 caracteres |
| `auth/too-many-requests` | Demasiados intentos o envíos de correo | Esperá unos minutos y volvé a intentar |
| La app dice “No se pudo abrir tu casa” | Las reglas no están publicadas o el correo dejó de estar autorizado | Publicá las reglas y revisá `config/access.allowedEmails` |
| `permission-denied` | Reglas desactualizadas, correo fuera de la lista o casa ajena | Publicá las reglas, revisá la lista y que el documento sea `households/{uid}` |
| Los datos de la versión anterior no aparecen | Ahora cada cuenta tiene su propia casa | Exportá/importá el JSON o migrá con el Admin SDK (paso 13) |
| `unavailable` | Sin conexión | Firestore usa caché local y sincroniza al volver |

---

## 15. Acceder a los datos

### Desde Firebase Console

**Firestore Database → Datos**. Buscá `households → {uid} → gastos`.

### Desde un script o backend con Firebase Admin SDK

1. En Firebase Console, andá a **Configuración del proyecto → Cuentas de servicio**.
2. Hacé clic en **Generar nueva clave privada**.
3. Guardá el archivo JSON **fuera del repositorio**.
4. Instalá el SDK:

```bash
npm install firebase-admin
```

5. Ejemplo de lectura de la casa de un usuario:

```js
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const uid = 'UID_DEL_USUARIO';
const snapshot = await db
  .collection('households')
  .doc(uid)
  .collection('gastos')
  .orderBy('fecha', 'desc')
  .get();

for (const doc of snapshot.docs) {
  console.log(doc.id, doc.data());
}
```

> La clave de servicio da acceso total al proyecto. Nunca la pongas en `src/`, en el frontend ni en el repositorio.

---

## 16. Plan gratuito y costos

Para dos personas, el plan gratuito **Spark** de Firestore suele ser más que suficiente. Al momento de escribir esto incluye, aproximadamente:

- 1 GiB de almacenamiento.
- 50.000 lecturas de documentos por día.
- 20.000 escrituras por día.
- 20.000 eliminaciones por día.

Cada operación sobre `gastos` también hace una lectura de `households/{uid}` y de `config/access` por las reglas de seguridad. Aun así, el volumen de un hogar es muy bajo.

Verificá los límites actuales en <https://firebase.google.com/pricing>.
