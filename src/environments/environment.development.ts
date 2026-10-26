import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  /** Activá esto solo si estás usando Firebase Emulator Suite en local. */
  useEmulators: false,
  firebase: firebaseConfig,
};
