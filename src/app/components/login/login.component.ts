import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from '@openng/optimus-ui/card';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PasswordModule } from '@openng/optimus-ui/password';
import { MessageModule } from '@openng/optimus-ui/message';
import { AuthService } from '../../services/auth.service';
import { AccessService } from '../../services/access.service';
import { isFirebaseConfigured } from '../../../environments/firebase.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  template: `
    <div
      class="flex align-items-center justify-content-center min-h-screen bg-gray-100"
    >
      <p-card header="Control de Gastos" class="w-full max-w-25rem">
        <div class="flex flex-column gap-3">
          @if (!firebaseConfigured) {
            <p-message severity="warn">
              Firebase no está configurado. Completá
              src/environments/firebase.config.ts con los datos de tu proyecto.
            </p-message>
          }

          <p class="m-0 text-600 text-center">
            Ingresá con tu cuenta de Google para acceder al historial del
            hogar.
          </p>

          <button
            pButton
            type="button"
            class="w-full"
            [disabled]="loading"
            (click)="loginWithGoogle()"
          >
            @if (loading) {
              <i class="pi pi-spin pi-spinner"></i>
              Conectando...
            } @else {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="#FFC107"
                  d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                />
              </svg>
              Continuar con Google
            }
          </button>

          <button
            pButton
            type="button"
            variant="text"
            class="w-full"
            [disabled]="loading"
            (click)="loginWithRedirect()"
          >
            ¿No se abre la ventana? Usar redirección
          </button>

          <div class="flex align-items-center gap-2 my-2">
            <span
              class="flex-1"
              style="height:1px;background:var(--p-surface-200)"
            ></span>
            <span class="text-500 text-sm">o</span>
            <span
              class="flex-1"
              style="height:1px;background:var(--p-surface-200)"
            ></span>
          </div>

          <div class="flex flex-column gap-2">
            <label for="email">Correo</label>
            <input
              pInputText
              id="email"
              type="email"
              class="w-full"
              [(ngModel)]="email"
              placeholder="tu@gmail.com"
              autocomplete="email"
              [disabled]="emailLoading || loading"
              (keyup.enter)="loginWithEmail()"
            />

            <label class="font-semibold">Contraseña</label>
            <p-password
              [(ngModel)]="password"
              [feedback]="false"
              [toggleMask]="true"
              [fluid]="true"
              [disabled]="emailLoading || loading"
              (keyup.enter)="loginWithEmail()"
            ></p-password>

            <button
              pButton
              type="button"
              class="w-full"
              [disabled]="emailLoading || loading"
              (click)="loginWithEmail()"
            >
              @if (emailLoading) {
                <i class="pi pi-spin pi-spinner"></i>
                Procesando...
              } @else {
                <i class="pi pi-sign-in"></i>
                Ingresar
              }
            </button>

            <button
              pButton
              type="button"
              variant="outlined"
              class="w-full"
              [disabled]="emailLoading || loading"
              (click)="registerWithEmail()"
            >
              <i class="pi pi-key"></i>
              Primera vez: asignar contraseña
            </button>

            <button
              pButton
              type="button"
              variant="text"
              class="w-full"
              [disabled]="emailLoading || loading"
              (click)="resetPassword()"
            >
              Olvidé mi contraseña
            </button>

            @if (resetSent) {
              <p-message severity="success">
                Si el correo tiene una cuenta con contraseña, recibirás un
                enlace para restablecerla.
              </p-message>
            }
          </div>

          @if (errorMessage) {
            <p-message severity="error">
              {{ errorMessage }}
            </p-message>
          }

          <small class="text-500 text-center">
            En el celular Google usa redirección. También podés entrar con
            correo y contraseña. Solo pueden entrar las cuentas autorizadas en
            <code>config/access</code>.
          </small>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  loading = false;
  emailLoading = false;
  resetSent = false;
  errorMessage = '';
  email = '';
  password = '';
  readonly firebaseConfigured = isFirebaseConfigured();

  constructor(
    private authService: AuthService,
    private accessService: AccessService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const authError = this.authService.consumeAuthError();

    if (authError) {
      this.errorMessage = this.mapAuthError(new Error(authError));
      return;
    }

    if (await this.authService.isAuthenticated()) {
      try {
        await this.accessService.assertAllowed();
        await this.router.navigate(['/dashboard']);
      } catch (error) {
        await this.authService.signOutSilently();
        this.errorMessage = this.mapAuthError(error);
      }
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.errorMessage = '';
    this.loading = true;

    try {
      await this.authService.loginWithGoogle();

      if (await this.authService.isAuthenticated()) {
        await this.router.navigate(['/dashboard']);
      }
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.loading = false;
    }
  }

  async loginWithRedirect(): Promise<void> {
    this.errorMessage = '';
    this.loading = true;

    try {
      await this.authService.loginWithGoogleRedirect();
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
      this.loading = false;
    }
  }

  async loginWithEmail(): Promise<void> {
    this.errorMessage = '';
    this.resetSent = false;

    if (!this.validateEmail()) {
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Ingresá tu contraseña.';
      return;
    }

    this.emailLoading = true;

    try {
      await this.authService.loginWithEmailPassword(
        this.email,
        this.password
      );
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
    }
  }

  async registerWithEmail(): Promise<void> {
    this.errorMessage = '';
    this.resetSent = false;

    if (!this.validateEmail()) {
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.emailLoading = true;

    try {
      await this.authService.registerWithEmailPassword(
        this.email,
        this.password
      );
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
    }
  }

  async resetPassword(): Promise<void> {
    this.errorMessage = '';
    this.resetSent = false;

    if (!this.validateEmail()) {
      return;
    }

    this.emailLoading = true;

    try {
      await this.authService.sendPasswordReset(this.email);
      this.resetSent = true;
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
    }
  }

  private validateEmail(): boolean {
    const email = this.email.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMessage = 'Ingresá un correo electrónico válido.';
      return false;
    }

    return true;
  }

  private mapAuthError(error: unknown): string {
    const firebaseCode = (error as { code?: string } | null)?.code ?? '';
    const customMessage = error instanceof Error ? error.message : '';
    const key = firebaseCode || customMessage;

    if (key === 'FIREBASE_NOT_CONFIGURED') {
      return 'Firebase no está configurado. Completá src/environments/firebase.config.ts.';
    }

    const messages: Record<string, string> = {
      EMAIL_NOT_ALLOWED:
        'Esta cuenta no está autorizada. Pedile al administrador que agregue tu email a config/access.allowedEmails en Firestore.',
      EMAIL_FOR_SIGN_IN_REQUIRED:
        'Ingresá el mismo email con el que pediste el enlace.',
      EMAIL_LINK_FAILED:
        'No se pudo completar el login con el enlace. Pedí uno nuevo.',
      ACCESS_CONFIG_MISSING:
        'Falta la lista de acceso en Firestore. Creá el documento config/access con el campo allowedEmails.',
      ACCESS_CONFIG_INVALID:
        'La lista de acceso está mal configurada. allowedEmails debe ser un array de correos.',
      ACCESS_CHECK_FAILED:
        'No se pudo verificar la lista de acceso. Revisá que firestore.rules esté publicado y tu conexión.',
      NOT_AUTHENTICATED: 'No hay una sesión activa. Intentá de nuevo.',
      'auth/invalid-credential':
        'Correo o contraseña incorrectos. Si es tu primera vez, usá “Primera vez: asignar contraseña”.',
      'auth/wrong-password':
        'Correo o contraseña incorrectos. Si es tu primera vez, usá “Primera vez: asignar contraseña”.',
      'auth/user-not-found':
        'No existe una cuenta con ese correo. Usá “Primera vez: asignar contraseña”.',
      'auth/email-already-in-use':
        'Ese correo ya tiene una cuenta. Si es una cuenta de Google, eliminala en Firebase Console → Authentication → Users y volvé a asignar la contraseña; si ya tiene contraseña, usá “Ingresar”.',
      'auth/weak-password':
        'La contraseña debe tener al menos 6 caracteres.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/requires-recent-login':
        'Volvé a iniciar sesión para completar esta acción.',
      'auth/operation-not-allowed':
        'Habilitá Email/Password (y Google si lo usás) en Firebase Authentication.',
      'auth/popup-closed-by-user': 'Inicio de sesión cancelado.',
      'auth/cancelled-popup-request': 'Inicio de sesión cancelado.',
      'auth/popup-blocked':
        'El navegador bloqueó la ventana de Google. Probá con correo y contraseña.',
      'auth/unauthorized-domain':
        'Este dominio no está autorizado en Firebase Authentication. Agregalo en Authentication → Settings → Authorized domains.',
      'auth/account-exists-with-different-credential':
        'Ya existe una cuenta con ese correo usando otro método de acceso.',
      'auth/network-request-failed':
        'Sin conexión. Verificá tu conexión a internet.',
      'auth/internal-error':
        'Firebase devolvió un error interno. Intentá de nuevo.',
      'auth/invalid-email': 'El correo electrónico no es válido.',
      'auth/invalid-action-code':
        'El enlace no es válido o ya se usó. Pedí uno nuevo.',
      'auth/expired-action-code': 'El enlace expiró. Pedí uno nuevo.',
      'auth/unauthorized-continue-uri':
        'El dominio no está autorizado para el enlace. Agregalo en Authentication → Settings → Authorized domains.',
      'auth/invalid-continue-uri':
        'La URL de continuación no es válida. Revisá el dominio autorizado.',
      'auth/quota-exceeded':
        'Se superó el límite de enlaces. Intentá más tarde.',
      'auth/too-many-requests':
        'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
      'auth/api-key-not-valid':
        'La configuración de Firebase no es válida. Revisá firebase.config.ts.',
      'auth/invalid-api-key':
        'La configuración de Firebase no es válida. Revisá firebase.config.ts.',
    };

    return (
      messages[key] ??
      `No se pudo iniciar sesión (${key || 'error desconocido'}).`
    );
  }
}
