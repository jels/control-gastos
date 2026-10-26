import { Injectable, inject } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import type {
  DocumentData,
  DocumentSnapshot,
  Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';

/**
 * Lista global de emails autorizados a usar la app.
 *
 * Fuente de verdad: `config/access.allowedEmails` en Firestore.
 * Las reglas de Firestore también usan ese documento, así que un email fuera
 * de la lista no puede leer ni escribir datos aunque tenga una sesión válida.
 *
 * El documento se puede leer antes del login para validar el correo. Solo
 * contiene emails; no guarda contraseñas ni datos sensibles.
 */
@Injectable({
  providedIn: 'root',
})
export class AccessService {
  private readonly firestore: Firestore = inject(FIRESTORE);
  private readonly auth: Auth = inject(FIREBASE_AUTH);

  /** Comprueba si un correo está autorizado, sin exigir sesión. */
  async isEmailAllowed(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const allowedEmails = await this.getAllowedEmails();

    if (allowedEmails.includes(normalized)) {
      return true;
    }

    if (
      allowedEmails.some(
        (allowed) => allowed.toLowerCase() === normalized
      )
    ) {
      throw new Error('ACCESS_CONFIG_CASE');
    }

    return false;
  }

  /** Comprueba el correo de la sesión actual y exige autenticación. */
  async assertAllowed(): Promise<void> {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const email = user.email?.trim().toLowerCase();

    if (!email) {
      throw new Error('EMAIL_NOT_ALLOWED');
    }

    if (!(await this.isEmailAllowed(email))) {
      throw new Error('EMAIL_NOT_ALLOWED');
    }
  }

  private async getAllowedEmails(): Promise<string[]> {
    let snapshot: DocumentSnapshot<DocumentData>;

    try {
      snapshot = await getDoc(doc(this.firestore, 'config', 'access'));
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'permission-denied') {
        console.error(
          'Firestore rechazó la lectura de config/access. Publicá firestore.rules (allow get: if true) y volvé a intentar.',
          error
        );
        throw new Error('ACCESS_CHECK_FAILED');
      }

      throw error;
    }

    if (!snapshot.exists()) {
      throw new Error('ACCESS_CONFIG_MISSING');
    }

    const allowed = snapshot.data()['allowedEmails'];

    if (!Array.isArray(allowed)) {
      throw new Error('ACCESS_CONFIG_INVALID');
    }

    // Se comparan literalmente con el email del token de Firebase, que
    // siempre llega en minúsculas. La lista debe guardarse en minúsculas.
    return allowed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim());
  }
}
