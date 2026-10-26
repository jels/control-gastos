import { Injectable, inject } from '@angular/core';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';

export interface HouseholdInfo {
  id: string;
  name: string;
}

/**
 * Cada cuenta tiene su propia casa.
 *
 * El documento se identifica con el UID del usuario (`households/{uid}`) y
 * los gastos viven en `households/{uid}/gastos`. No hay miembros compartidos:
 * una cuenta nunca puede leer ni fusionar los gastos de otra.
 */
@Injectable({
  providedIn: 'root',
})
export class HouseholdService {
  private readonly firestore: Firestore = inject(FIRESTORE);
  private readonly auth: Auth = inject(FIREBASE_AUTH);

  /**
   * Garantiza que la casa privada del usuario actual exista.
   * Si todavía no existe, la crea con su UID como dueño.
   */
  async ensureHousehold(): Promise<HouseholdInfo> {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const uid = user.uid;
    const email = (user.email ?? '').trim().toLowerCase();
    const householdRef = doc(this.firestore, 'households', uid);
    const snapshot = await getDoc(householdRef);

    if (snapshot.exists()) {
      return this.toHousehold(uid, snapshot.data());
    }

    const name = this.householdName();

    try {
      await setDoc(householdRef, {
        name,
        ownerUid: uid,
        ownerEmail: email,
        createdAt: serverTimestamp(),
      });

      return { id: uid, name };
    } catch (error) {
      // Si otra pestaña la creó al mismo tiempo, se reutiliza.
      const retry = await this.tryRead(householdRef);

      if (retry?.exists()) {
        return this.toHousehold(uid, retry.data());
      }

      throw error;
    }
  }

  /** Identidad que se muestra y se guarda en cada gasto. */
  getCurrentIdentity(): { uid: string; email: string; name: string } {
    const user = this.auth.currentUser;
    const email = user?.email ?? '';

    return {
      uid: user?.uid ?? '',
      email,
      name:
        user?.displayName?.trim() ||
        this.nameFromEmail(email) ||
        email ||
        'Usuario',
    };
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0]?.trim() ?? '';

    if (!local) {
      return '';
    }

    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private householdName(): string {
    const identity = this.getCurrentIdentity();
    return `Casa de ${identity.name}`.slice(0, 100);
  }

  private async tryRead(
    reference: DocumentReference<DocumentData>
  ): Promise<DocumentSnapshot<DocumentData> | null> {
    try {
      return await getDoc(reference);
    } catch (error) {
      if (this.isPermissionDenied(error)) {
        return null;
      }

      throw error;
    }
  }

  private toHousehold(householdId: string, data: DocumentData): HouseholdInfo {
    if (data['ownerUid'] !== householdId) {
      throw new Error('HOUSEHOLD_OWNER_MISMATCH');
    }

    return {
      id: householdId,
      name: typeof data['name'] === 'string' ? data['name'] : 'Mi casa',
    };
  }

  private isPermissionDenied(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === 'permission-denied';
  }
}
