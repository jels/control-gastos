import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getRedirectResult,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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
  emailVerified: boolean;
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
  private readonly googleProvider = new GoogleAuthProvider();
  private authError = '';
  private passwordLinked = false;

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
      await this.saveUserProfile(credential.user);
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

  /** Devuelve los métodos de acceso registrados para un correo. */
  async getSignInMethods(email: string): Promise<string[]> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    return fetchSignInMethodsForEmail(this.auth, this.normalizeEmail(email));
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
    await this.saveUserProfile(credential.user);
    this.passwordLinked = true;
  }

  /**
   * Crea la cuenta y asigna la contraseña en el primer login.
   * Si el correo ya existe, Firebase devuelve auth/email-already-in-use.
   *
   * La cuenta se puede usar de inmediato. Además se envía un correo de
   * verificación como recomendación de seguridad, pero no bloquea el acceso.
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
    await this.savePasswordRecord(credential.user);
    await this.sendVerificationEmailQuietly(credential.user);
    this.passwordLinked = true;
  }

  /**
   * Vincula una contraseña a una cuenta que ya existe con Google.
   *
   * Firebase no permite asignar contraseña a una cuenta federada sin
   * autenticarse primero con Google. Este flujo hace eso y conserva el
   * mismo UID, por lo que la casa y los gastos no se pierden.
   */
  async linkPasswordWithGoogle(
    email: string,
    password: string
  ): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    const normalized = this.normalizeEmail(email);
    await this.assertEmailAllowed(normalized);

    let user = this.auth.currentUser;
    const alreadySignedInWithGoogle =
      !!user &&
      this.normalizeEmail(user.email ?? '') === normalized &&
      user.providerData.some(
        (provider) => provider.providerId === 'google.com'
      );

    if (!alreadySignedInWithGoogle) {
      try {
        const credential = await signInWithPopup(
          this.auth,
          this.googleProvider
        );
        user = credential.user;
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;

        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          throw new Error('GOOGLE_POPUP_BLOCKED');
        }

        throw error;
      }
    }

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    if (this.normalizeEmail(user.email ?? '') !== normalized) {
      await this.signOutSilently();
      throw new Error('GOOGLE_EMAIL_MISMATCH');
    }

    try {
      const linked = await linkWithCredential(
        user,
        EmailAuthProvider.credential(normalized, password)
      );

      await this.enforceAllowlist();
      await this.saveUserProfile(linked.user);
      await this.savePasswordRecord(linked.user);
      this.passwordLinked = true;
    } catch (error) {
      await this.signOutSilently();
      throw error;
    }
  }

  /** Reenvía el correo de verificación de la cuenta actual. */
  async resendVerificationEmail(): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    if (user.emailVerified) {
      return;
    }

    await sendEmailVerification(user, this.verificationSettings());
  }

  /**
   * Recarga la cuenta y comprueba si ya verificó el correo.
   * La verificación es opcional: no bloquea el uso de la app.
   */
  async refreshEmailVerification(): Promise<boolean> {
    if (!isFirebaseConfigured()) {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    }

    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    await user.reload();

    if (!user.emailVerified) {
      return false;
    }

    await user.getIdToken(true);
    await this.saveUserProfile(user);

    return true;
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
          emailVerified: user.emailVerified,
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
        await this.saveUserProfile(result.user);
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
    this.passwordLinked = false;
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

  getCurrentUserEmail(): string {
    return this.auth.currentUser?.email ?? '';
  }

  getCurrentUserPhotoUrl(): string {
    return this.auth.currentUser?.photoURL ?? '';
  }

  getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  getCurrentUserEmailVerified(): boolean {
    return this.auth.currentUser?.emailVerified ?? false;
  }

  /** Indica si la cuenta ya tiene una contraseña vinculada en Firebase Auth. */
  hasPasswordProvider(): boolean {
    return (
      this.passwordLinked ||
      (this.auth.currentUser?.providerData.some(
        (provider) => provider.providerId === 'password'
      ) ??
        false)
    );
  }

  /** Indica si la sesión actual está autenticada con Google. */
  hasGoogleProvider(): boolean {
    return (
      this.auth.currentUser?.providerData.some(
        (provider) => provider.providerId === 'google.com'
      ) ?? false
    );
  }

  getCurrentIdentity(): UserIdentity {
    const user = this.auth.currentUser;

    return {
      uid: user?.uid ?? '',
      email: user?.email ?? '',
      name: this.getCurrentUser(),
    };
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
    const provider = this.providerOf(user);
    const profile: Record<string, unknown> = {
      email: (user.email ?? '').trim().toLowerCase(),
      displayName,
      provider,
      emailVerified: user.emailVerified,
      lastLogin: serverTimestamp(),
    };

    if (provider === 'password') {
      profile['passwordSet'] = true;
    }

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

    if (provider === 'password') {
      await this.savePasswordRecord(user);
    }
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

  private providerOf(user: User): 'password' | 'google.com' {
    return user.providerData.some(
      (provider) => provider.providerId === 'password'
    )
      ? 'password'
      : 'google.com';
  }

  private async sendVerificationEmailQuietly(user: User): Promise<boolean> {
    try {
      await sendEmailVerification(user, this.verificationSettings());
      return true;
    } catch (error) {
      console.warn('No se pudo enviar el correo de verificación.', error);
      return false;
    }
  }

  private verificationSettings(): {
    url: string;
    handleCodeInApp: boolean;
  } {
    return {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    };
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
}
