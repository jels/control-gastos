import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');

/**
 * Conexión directa con el SDK modular de Firebase (sin @angular/fire).
 * No hay una versión estable de AngularFire para Angular 22; usamos los paquetes oficiales.
 */
export function provideFirebase(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_APP,
      useFactory: () => initializeApp(environment.firebase),
    },
    {
      provide: FIREBASE_AUTH,
      useFactory: (app: FirebaseApp) => {
        const auth = getAuth(app);

        if (environment.useEmulators) {
          connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
            disableWarnings: true,
          });
        }

        return auth;
      },
      deps: [FIREBASE_APP],
    },
    {
      provide: FIRESTORE,
      useFactory: (app: FirebaseApp) => {
        let firestore: Firestore;

        try {
          firestore = initializeFirestore(app, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          });
        } catch (error) {
          console.warn(
            'Firestore: no se pudo habilitar la caché offline, se usará la configuración por defecto.',
            error
          );
          firestore = getFirestore(app);
        }

        if (environment.useEmulators) {
          connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
        }

        return firestore;
      },
      deps: [FIREBASE_APP],
    },
  ]);
}
