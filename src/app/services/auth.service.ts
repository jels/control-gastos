import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { isFirebaseConfigured } from '../../environments/firebase.config';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';
import { AccessService } from './access.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore: Firestore = inject(FIRESTORE);
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
   * En celular/PWA usa redirect directo, porque los navegadores móviles
   * suelen bloquear los popups. En escritorio usa popup y cae a redirect
   * si el navegador lo bloquea.
   */
  async loginWithGoogle(): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    if (this.shouldUseRedirect()) {
      await this.loginWithGoogleRedirect();
      return;
    }

    try {
      const credential = await signInWithPopup(this.auth, this.googleProvider);
      await this.enforceAllowlist();
      await this.saveUserProfile(credential.user, 'google.com');
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await this.loginWithGoogleRedirect();
        return;
      }

      throw error;
    }
  }

  /** Fuerza el flujo de redirección (útil si el popup no se abre). */
  async loginWithGoogleRedirect(): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    await signInWithRedirect(this.auth, this.googleProvider);
  }

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
    await this.saveUserProfile(credential.user, 'password');
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
    const credential = await createUserWithEmailAndPassword(
      this.auth,
      normalized,
      password
    );

    try {
      await updateProfile(credential.user, {
        displayName: normalized.split('@')[0],
      });
    } catch {
      // El perfil no bloquea el registro.
    }

    await this.enforceAllowlist();
    await this.saveUserProfile(credential.user, 'password');
  }

  /** Envía el correo para restablecer la contraseña. */
  async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    await sendPasswordResetEmail(this.auth, this.normalizeEmail(email));
  }

  /**
   * Envía un enlace mágico al email indicado.
   * Requiere habilitar Email/Password + Email link en Firebase Authentication.
   */
  async sendEmailLink(email: string): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    const normalized = email.trim().toLowerCase();
    const continueUrl = `${window.location.origin}/login?email=${encodeURIComponent(
      normalized
    )}`;

    await sendSignInLinkToEmail(this.auth, normalized, {
      url: continueUrl,
      handleCodeInApp: true,
    });

    localStorage.setItem('emailForSignIn', normalized);
  }

  /**
   * Completa el login si la URL actual es un enlace mágico de Firebase.
   * Devuelve true si procesó un enlace.
   */
  async handleEmailLinkResult(): Promise<boolean> {
    if (!isFirebaseConfigured()) {
      return false;
    }

    const href = window.location.href;

    if (!isSignInWithEmailLink(this.auth, href)) {
      return false;
    }

    const url = new URL(href);
    let email =
      url.searchParams.get('email')?.trim().toLowerCase() ||
      localStorage.getItem('emailForSignIn') ||
      '';

    if (!email) {
      email =
        window
          .prompt('Ingresá el email con el que pediste el enlace')
          ?.trim()
          .toLowerCase() ?? '';
    }

    if (!email) {
      this.setAuthError('EMAIL_FOR_SIGN_IN_REQUIRED');
      return false;
    }

    try {
      await signInWithEmailLink(this.auth, email, href);
      localStorage.removeItem('emailForSignIn');
      await this.enforceAllowlist();
      return true;
    } catch (error) {
      await this.signOutSilently();
      this.setAuthError(this.errorCode(error));
      return false;
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
        await this.saveUserProfile(result.user, 'google.com');
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

  private async saveUserProfile(
    user: User,
    provider: 'password' | 'google.com'
  ): Promise<void> {
    try {
      await setDoc(
        doc(this.firestore, 'usuarios', user.uid),
        {
          email: user.email ?? '',
          displayName: user.displayName ?? '',
          provider,
          lastLogin: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn(
        'No se pudo guardar el perfil del usuario en Firestore.',
        error
      );
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private shouldUseRedirect(): boolean {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return true;
    }

    const userAgent = navigator.userAgent || '';
    const isMobile =
      /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent);
    const isIPadOS =
      /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    return isMobile || isIPadOS || isStandalone;
  }

  private errorCode(error: unknown): string {
    const code = (error as { code?: string } | null)?.code;

    if (code) {
      return code;
    }

    return error instanceof Error ? error.message : 'EMAIL_LINK_FAILED';
  }
}
