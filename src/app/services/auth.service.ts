import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { isFirebaseConfigured } from '../../environments/firebase.config';
import { FIREBASE_AUTH } from '../firebase.providers';
import { AccessService } from './access.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly router = inject(Router);
  private readonly accessService = inject(AccessService);
  private readonly googleProvider = new GoogleAuthProvider();
  private authError = '';

  constructor() {
    this.googleProvider.setCustomParameters({
      prompt: 'select_account',
    });
  }

  /**
   * Inicia sesión con Google.
   *
   * Usa popup como método principal (funciona mejor con el bloqueo de
   * almacenamiento de terceros de Brave). Si el navegador bloquea el popup,
   * cae a redirect. El resultado del redirect se completa en
   * `handleRedirectResult`.
   */
  async loginWithGoogle(): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    try {
      await signInWithPopup(this.auth, this.googleProvider);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(this.auth, this.googleProvider);
        return;
      }

      throw error;
    }

    await this.enforceAllowlist();
  }

  /** Completa un login con redirect al volver a la app. */
  async handleRedirectResult(): Promise<void> {
    if (!isFirebaseConfigured()) {
      return;
    }

    try {
      const result = await getRedirectResult(this.auth);

      if (!result?.user) {
        return;
      }

      try {
        await this.accessService.assertAllowed();
      } catch (error) {
        await this.signOutSilently();
        this.setAuthError(
          error instanceof Error ? error.message : 'ACCESS_CHECK_FAILED'
        );
      }
    } catch (error) {
      console.error('Error al completar el login con Google:', error);
    }
  }

  async logout(): Promise<void> {
    this.authError = '';
    await this.signOutSilently();
    await this.router.navigate(['/login']);
  }

  async signOutSilently(): Promise<void> {
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

  getCurrentUser(): string {
    const user = this.auth.currentUser;
    return user?.displayName?.trim() || user?.email || '';
  }

  getCurrentUserEmail(): string {
    return this.auth.currentUser?.email ?? '';
  }

  getCurrentUserPhotoUrl(): string {
    return this.auth.currentUser?.photoURL ?? '';
  }

  getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  private async enforceAllowlist(): Promise<void> {
    try {
      await this.accessService.assertAllowed();
    } catch (error) {
      await this.signOutSilently();
      throw error;
    }
  }
}
