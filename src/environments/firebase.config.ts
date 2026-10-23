import type { FirebaseOptions } from 'firebase/app';

/**
 * Configuración pública del proyecto Firebase.
 *
 * Estos valores NO son secretos: viajan en el bundle del navegador.
 * La seguridad real de los datos vive en `firestore.rules`.
 *
 * Reemplazá los valores "TU_..." por los que te muestra Firebase Console:
 * Configuración del proyecto (⚙️) → Tus apps → App web → Configuración del SDK.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyBmmktOiCGY_Ioe79T54E5tSO4dP8DJv50',
  authDomain: 'gastos-jels.firebaseapp.com',
  projectId: 'gastos-jels',
  storageBucket: 'gastos-jels.firebasestorage.app',
  messagingSenderId: '445045156382',
  appId: '1:445045156382:web:71bce47e55f02037df5c0f',
};

const PLACEHOLDER_PREFIXES = ['TU_', 'REEMPLAZA', 'YOUR_'];

/**
 * Devuelve true cuando la configuración mínima dejó de ser un placeholder.
 * Se usa para mostrar un mensaje claro en el login en lugar de un error opaco.
 */
export function isFirebaseConfigured(): boolean {
  const required = [
    firebaseConfig.apiKey,
    firebaseConfig.projectId,
    firebaseConfig.appId,
  ];

  return required.every(
    (value) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      !PLACEHOLDER_PREFIXES.some((prefix) => value.startsWith(prefix)),
  );
}
