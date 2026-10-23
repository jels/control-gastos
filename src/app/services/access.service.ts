import { Injectable, inject } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';

/**
 * Lista global de emails autorizados a usar la app.
 *
 * Fuente de verdad: `config/access.allowedEmails` en Firestore.
 * Las reglas de Firestore también usan ese documento, así que un email fuera
 * de la lista no puede leer ni escribir datos aunque tenga una sesión válida.
 */
@Injectable({
  providedIn: 'root',
})
export class AccessService {
  private readonly firestore: Firestore = inject(FIRESTORE);
  private readonly auth: Auth = inject(FIREBASE_AUTH);

  async assertAllowed(): Promise<void> {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const email = user.email?.trim().toLowerCase();

    if (!email) {
      throw new Error('EMAIL_NOT_ALLOWED');
    }

    let snapshot: DocumentSnapshot<DocumentData>;

    try {
      snapshot = await getDoc(
        doc(this.firestore, 'config', 'access')
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'permission-denied') {
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

    const allowedEmails = allowed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase());

    if (!allowedEmails.includes(email)) {
      throw new Error('EMAIL_NOT_ALLOWED');
    }
  }
}
