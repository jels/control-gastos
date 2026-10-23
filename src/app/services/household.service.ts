import { Injectable, inject } from '@angular/core';
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { environment } from '../../environments/environment';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';

export class HouseholdAccessError extends Error {
  constructor(
    readonly email: string,
    readonly uid: string
  ) {
    super('Tu cuenta no tiene acceso al hogar.');
    this.name = 'HouseholdAccessError';
  }
}

export interface HouseholdInfo {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class HouseholdService {
  private readonly firestore: Firestore = inject(FIRESTORE);
  private readonly auth: Auth = inject(FIREBASE_AUTH);

  /**
   * Garantiza que el documento del hogar exista.
   *
   * - Si no existe, lo crea con el usuario actual como único miembro.
   * - Si existe y el usuario es miembro, lo devuelve.
   * - Si existe y el usuario no es miembro, lanza HouseholdAccessError.
   */
  async ensureHousehold(): Promise<HouseholdInfo> {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const email = user.email ?? '';
    const uid = user.uid;
    const householdRef = doc(
      this.firestore,
      'households',
      environment.householdId
    );

    let snapshot: DocumentSnapshot<DocumentData>;

    try {
      snapshot = await getDoc(householdRef);
    } catch (error) {
      if (this.isPermissionDenied(error)) {
        const joined = await this.tryJoin(householdRef, email, uid);

        if (joined) {
          return joined;
        }

        throw new HouseholdAccessError(email, uid);
      }

      throw error;
    }

    if (snapshot.exists()) {
      return this.toHousehold(snapshot.data());
    }

    try {
      await setDoc(householdRef, {
        name: 'Casa',
        ownerUid: uid,
        members: [uid],
        memberEmails: email ? [email] : [],
        createdAt: serverTimestamp(),
      });

      return {
        id: environment.householdId,
        name: 'Casa',
      };
    } catch (error) {
      if (this.isAlreadyExists(error) || this.isPermissionDenied(error)) {
        const retry = await this.tryRead(householdRef);

        if (retry?.exists()) {
          return this.toHousehold(retry.data());
        }

        throw new HouseholdAccessError(email, uid);
      }

      throw error;
    }
  }

  getCurrentIdentity(): { email: string; uid: string } {
    const user = this.auth.currentUser;

    return {
      email: user?.email ?? '',
      uid: user?.uid ?? '',
    };
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

  private async tryJoin(
    reference: DocumentReference<DocumentData>,
    email: string,
    uid: string
  ): Promise<HouseholdInfo | null> {
    if (!email) {
      return null;
    }

    try {
      await updateDoc(reference, {
        members: arrayUnion(uid),
        memberEmails: arrayUnion(email),
      });

      const snapshot = await getDoc(reference);

      return snapshot.exists() ? this.toHousehold(snapshot.data()) : null;
    } catch (error) {
      if (this.isPermissionDenied(error) || this.isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  private toHousehold(data: DocumentData): HouseholdInfo {
    return {
      id: environment.householdId,
      name: typeof data['name'] === 'string' ? data['name'] : 'Casa',
    };
  }

  private isPermissionDenied(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === 'permission-denied';
  }

  private isAlreadyExists(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === 'already-exists';
  }

  private isNotFound(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === 'not-found';
  }
}
