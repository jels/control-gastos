import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { isFirebaseConfigured } from '../../environments/firebase.config';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';
import { AccessService } from './access.service';

export interface SessionState {
  uid: string;
  email: string;
  displayName: string;
}

export interface UserIdentity {
  uid: string;
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore: Firestore = inject(FIRESTORE);
  private readonly router = inject(Router);
  private readonly accessService = inject(AccessService);
  private authError = '';
  private passwordReady = false;

  /** Inicia sesión con el correo y la contraseña de Firebase Auth. */
  async loginWithEmailPassword(
    email: string,
    password: string
  ): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    const normalized = this.normalizeEmail(email);
    const credential = await signInWithEmailAndPassword(
      this.auth,
      normalized,
      password
    );

    await this.enforceAllowlist();
    await this.saveUserProfile(credential.user);
    this.passwordReady = true;
  }

  /**
   * Crea la cuenta y asigna la contraseña en el primer login.
   * Si el correo ya existe, Firebase devuelve auth/email-already-in-use.
   */
  async registerWithEmailPassword(
    email: string,
    password: string
  ): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    const normalized = this.normalizeEmail(email);
    await this.assertEmailAllowed(normalized);

    const credential = await createUserWithEmailAndPassword(
      this.auth,
      normalized,
      password
    );

    await this.saveUserProfile(credential.user);
    this.passwordReady = true;
  }

  /**
   * Consulta el índice público de cuentas con contraseña.
   * Permite saber si hay que pedir contraseña incluso si Firebase tiene
   * activada la protección contra enumeración de emails.
   */
  async hasPasswordRecord(email: string): Promise<boolean> {
    const normalized = this.normalizeEmail(email);

    try {
      const snapshot = await getDoc(
        doc(this.firestore, 'acceso', normalized)
      );

      return (
        snapshot.exists() && snapshot.data()['passwordSet'] === true
      );
    } catch (error) {
      console.warn('No se pudo consultar el índice de acceso.', error);
      return false;
    }
  }

  /** Estado de la sesión, sin tocar Firestore. */
  async getSession(): Promise<SessionState | null> {
    await this.auth.authStateReady();

    const user = this.auth.currentUser;

    return user
      ? {
          uid: user.uid,
          email: user.email ?? '',
          displayName:
            user.displayName?.trim() ||
            this.nameFromEmail(user.email ?? '') ||
            user.email?.trim() ||
            '',
        }
      : null;
  }

  /** Envía el correo para restablecer la contraseña. */
  async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    await sendPasswordResetEmail(this.auth, this.normalizeEmail(email));
  }

  async logout(): Promise<void> {
    this.authError = '';
    await this.signOutSilently();
    await this.router.navigate(['/login']);
  }

  async signOutSilently(): Promise<void> {
    this.passwordReady = false;
    await signOut(this.auth);
  }

  setAuthError(code: string): void {
    this.authError = code;
  }

  consumeAuthError(): string {
    const error = this.authError;
    this.authError = '';
    return error;
  }

  /**
   * Espera a que Firebase restaure la sesión persistida antes de decidir.
   * Esto evita redirecciones incorrectas al recargar la página.
   */
  async isAuthenticated(): Promise<boolean> {
    await this.auth.authStateReady();
    return this.auth.currentUser !== null;
  }

  /** Deja registrado en el perfil a qué casa pertenece la cuenta. */
  async saveHouseholdAssignment(householdId: string): Promise<void> {
    const user = this.auth.currentUser;

    if (!user) {
      return;
    }

    try {
      await setDoc(
        doc(this.firestore, 'usuarios', user.uid),
        { householdId },
        { merge: true }
      );
    } catch (error) {
      console.warn(
        'No se pudo guardar la casa del usuario en Firestore.',
        error
      );
    }
  }

  /** Nombre visible de la persona que está usando la cuenta. */
  getCurrentUser(): string {
    const user = this.auth.currentUser;

    if (!user) {
      return '';
    }

    return (
      user.displayName?.trim() ||
      this.nameFromEmail(user.email ?? '') ||
      user.email ||
      ''
    );
  }

  getCurrentUserPhotoUrl(): string {
    return this.auth.currentUser?.photoURL ?? '';
  }

  getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  getCurrentIdentity(): UserIdentity {
    return {
      uid: this.auth.currentUser?.uid ?? '',
      email: this.auth.currentUser?.email ?? '',
      name: this.getCurrentUser(),
    };
  }

  /**
   * Indica si la sesión actual se autenticó con correo y contraseña.
   * Una sesión vieja de otro proveedor se rechaza.
   */
  async hasPasswordSession(): Promise<boolean> {
    if (this.passwordReady) {
      return true;
    }

    const user = this.auth.currentUser;

    if (!user) {
      return false;
    }

    try {
      const token = await user.getIdTokenResult();
      return token.signInProvider === 'password';
    } catch (error) {
      console.warn('No se pudo verificar el método de acceso.', error);
      return false;
    }
  }

  private async enforceAllowlist(): Promise<void> {
    try {
      await this.accessService.assertAllowed();
    } catch (error) {
      await this.signOutSilently();
      throw error;
    }
  }

  private async assertEmailAllowed(email: string): Promise<void> {
    const allowed = await this.accessService.isEmailAllowed(email);

    if (!allowed) {
      throw new Error('EMAIL_NOT_ALLOWED');
    }
  }

  private async saveUserProfile(user: User): Promise<void> {
    const displayName = await this.ensureDisplayName(user);
    const email = (user.email ?? '').trim().toLowerCase();
    const profile = {
      email,
      displayName,
      provider: 'password',
      passwordSet: true,
      lastLogin: serverTimestamp(),
    };

    try {
      await setDoc(
        doc(this.firestore, 'usuarios', user.uid),
        profile,
        { merge: true }
      );
    } catch (error) {
      console.warn(
        'No se pudo guardar el perfil del usuario en Firestore.',
        error
      );
    }

    await this.savePasswordRecord(user);
  }

  /**
   * Índice mínimo para saber si un correo ya tiene contraseña antes del login.
   * No guarda la contraseña ni su hash: eso queda en Firebase Authentication.
   */
  private async savePasswordRecord(user: User): Promise<void> {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return;
    }

    try {
      await setDoc(
        doc(this.firestore, 'acceso', email),
        {
          email,
          uid: user.uid,
          passwordSet: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('No se pudo guardar el índice de acceso.', error);
    }
  }

  private async ensureDisplayName(user: User): Promise<string> {
    const existing = user.displayName?.trim();

    if (existing) {
      return existing;
    }

    const name = this.nameFromEmail(user.email ?? '');

    try {
      await updateProfile(user, { displayName: name });
    } catch (error) {
      console.warn('No se pudo guardar el nombre del usuario.', error);
    }

    return name;
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0]?.trim() ?? '';

    if (!local) {
      return 'Usuario';
    }

    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
