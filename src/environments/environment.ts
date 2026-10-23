import { firebaseConfig } from './firebase.config';

export const environment = {
  production: true,
  /** Activá esto solo si estás usando Firebase Emulator Suite en local. */
  useEmulators: false,
  /** ID del documento `households/{householdId}` que comparten ambos usuarios. */
  householdId: 'casa',
  firebase: firebaseConfig,
};
