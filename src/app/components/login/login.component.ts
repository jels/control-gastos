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

type LoginStep = 'email' | 'password' | 'assign' | 'verify' | 'blocked';

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

          @if (step === 'email') {
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
                [disabled]="checkingEmail"
                (keyup.enter)="checkEmail()"
              />

              <button
                pButton
                type="button"
                class="w-full"
                [disabled]="checkingEmail"
                (click)="checkEmail()"
              >
                @if (checkingEmail) {
                  <i class="pi pi-spin pi-spinner"></i>
                  Verificando...
                } @else {
                  <i class="pi pi-sign-in"></i>
                  Ingresar
                }
              </button>
            </div>
          }

          @if (step === 'password') {
            <div class="flex flex-column gap-2">
              <label for="locked-email">Correo</label>
              <input
                pInputText
                id="locked-email"
                type="email"
                class="w-full"
                [value]="email"
                disabled
              />

              <label class="font-semibold">Contraseña</label>
              <p-password
                [(ngModel)]="password"
                [feedback]="false"
                [toggleMask]="true"
                [fluid]="true"
                [disabled]="emailLoading"
                (keyup.enter)="loginWithPassword()"
              ></p-password>

              @if (allowAssign) {
                <p class="m-0 text-600 text-sm text-center">
                  Si es tu primera vez con este correo, usá “Asignar
                  contraseña”.
                </p>
              }

              <button
                pButton
                type="button"
                class="w-full"
                [disabled]="emailLoading"
                (click)="loginWithPassword()"
              >
                @if (emailLoading) {
                  <i class="pi pi-spin pi-spinner"></i>
                  Ingresando...
                } @else {
                  <i class="pi pi-sign-in"></i>
                  Ingresar
                }
              </button>

              @if (allowAssign) {
                <button
                  pButton
                  type="button"
                  variant="outlined"
                  class="w-full"
                  [disabled]="emailLoading"
                  (click)="assignPassword()"
                >
                  <i class="pi pi-key"></i>
                  Asignar contraseña
                </button>
              }

              <button
                pButton
                type="button"
                variant="text"
                class="w-full"
                [disabled]="emailLoading"
                (click)="resetAccount()"
              >
                Usar otra cuenta
              </button>
            </div>
          }

          @if (step === 'assign') {
            <div class="flex flex-column gap-2">
              <p class="m-0 text-600 text-center">
                Es la primera vez con este correo. Asigná una contraseña.
              </p>

              <label for="assign-email">Correo</label>
              <input
                pInputText
                id="assign-email"
                type="email"
                class="w-full"
                [value]="email"
                disabled
              />

              <label class="font-semibold">Contraseña</label>
              <p-password
                [(ngModel)]="password"
                [feedback]="false"
                [toggleMask]="true"
                [fluid]="true"
                [disabled]="emailLoading"
                (keyup.enter)="assignPassword()"
              ></p-password>

              <button
                pButton
                type="button"
                class="w-full"
                [disabled]="emailLoading"
                (click)="assignPassword()"
              >
                @if (emailLoading) {
                  <i class="pi pi-spin pi-spinner"></i>
                  Guardando...
                } @else {
                  <i class="pi pi-key"></i>
                  Asignar contraseña
                }
              </button>

              <button
                pButton
                type="button"
                variant="text"
                class="w-full"
                [disabled]="emailLoading"
                (click)="resetAccount()"
              >
                Usar otra cuenta
              </button>
            </div>
          }

          @if (step === 'verify') {
            <div class="flex flex-column gap-2">
              <p class="m-0 font-semibold text-center">Verificá tu correo</p>
              <p class="m-0 text-600 text-center">
                Te enviamos un enlace a <strong>{{ email }}</strong>. Abrí el
                enlace y después tocá “Ya verifiqué”.
              </p>

              @if (verificationEmailSent === false) {
                <p-message severity="warn">
                  No pudimos enviar el correo automáticamente. Usá “Reenviar
                  correo”.
                </p-message>
              }

              @if (infoMessage) {
                <p-message severity="success">{{ infoMessage }}</p-message>
              }

              <button
                pButton
                type="button"
                class="w-full"
                [disabled]="emailLoading"
                (click)="checkVerification()"
              >
                @if (emailLoading) {
                  <i class="pi pi-spin pi-spinner"></i>
                  Verificando...
                } @else {
                  <i class="pi pi-check"></i>
                  Ya verifiqué
                }
              </button>

              <button
                pButton
                type="button"
                variant="outlined"
                class="w-full"
                [disabled]="emailLoading"
                (click)="resendVerification()"
              >
                <i class="pi pi-envelope"></i>
                Reenviar correo
              </button>

              <button
                pButton
                type="button"
                variant="text"
                class="w-full"
                [disabled]="emailLoading"
                (click)="resetAccount()"
              >
                Usar otra cuenta
              </button>
            </div>
          }

          @if (step === 'blocked') {
            <p-message severity="warn">
              Ese correo ya existe con Google y no tiene contraseña asignada.
              Para usar contraseña, eliminá el usuario en Firebase Console →
              Authentication → Users y volvé a intentar con “Asignar
              contraseña”.
            </p-message>

            <button
              pButton
              type="button"
              variant="outlined"
              class="w-full"
              [disabled]="emailLoading"
              (click)="resetAccount()"
            >
              <i class="pi pi-arrow-left"></i>
              Usar otra cuenta
            </button>
          }

          @if (errorMessage) {
            <p-message severity="error">
              {{ errorMessage }}
            </p-message>
          }

          <small class="text-500 text-center">
            Solo pueden entrar las cuentas autorizadas en
            <code>config/access</code>.
          </small>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  step: LoginStep = 'email';
  email = '';
  password = '';
  checkingEmail = false;
  emailLoading = false;
  allowAssign = false;
  verificationEmailSent: boolean | null = null;
  errorMessage = '';
  infoMessage = '';
  readonly firebaseConfigured = isFirebaseConfigured();

  constructor(
    private authService: AuthService,
    private accessService: AccessService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const authError = this.authService.consumeAuthError();
    const session = await this.authService.getSession();

    if (session) {
      this.email = session.email;

      if (!session.emailVerified) {
        this.step = 'verify';

        if (authError && authError !== 'EMAIL_NOT_VERIFIED') {
          this.errorMessage = this.mapAuthError(new Error(authError));
        }

        return;
      }

      try {
        await this.accessService.assertAllowed();
        await this.router.navigate(['/dashboard']);
      } catch (error) {
        await this.authService.signOutSilently();
        this.errorMessage = this.mapAuthError(error);
      }

      return;
    }

    if (authError) {
      this.errorMessage = this.mapAuthError(new Error(authError));
    }
  }

  async checkEmail(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.validateEmail()) {
      return;
    }

    const normalized = this.email.trim().toLowerCase();
    this.checkingEmail = true;

    try {
      const methods = await this.authService.getSignInMethods(normalized);

      this.email = normalized;
      this.password = '';

      if (methods.includes('password')) {
        this.step = 'password';
        this.allowAssign = false;
      } else if (methods.includes('google.com')) {
        this.step = 'blocked';
        this.allowAssign = false;
      } else {
        this.step = 'assign';
        this.allowAssign = false;
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? '';

      if (code === 'auth/network-request-failed') {
        this.errorMessage = this.mapAuthError(error);
        return;
      }

      // Firebase puede bloquear la consulta por email enumeration protection.
      // Mostramos el paso de contraseña y dejamos también la opción de asignarla.
      this.email = normalized;
      this.step = 'password';
      this.allowAssign = true;
      this.errorMessage =
        'No se pudo verificar si el correo ya tiene contraseña. Si es tu primera vez, usá “Asignar contraseña”.';
    } finally {
      this.checkingEmail = false;
    }
  }

  async loginWithPassword(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.password) {
      this.errorMessage = 'Ingresá tu contraseña.';
      return;
    }

    this.emailLoading = true;

    try {
      const result = await this.authService.loginWithEmailPassword(
        this.email,
        this.password
      );

      if (result.verificationRequired) {
        this.step = 'verify';
        this.verificationEmailSent = result.verificationEmailSent;
        this.password = '';
        return;
      }

      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
    }
  }

  async assignPassword(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.emailLoading = true;

    try {
      const result = await this.authService.registerWithEmailPassword(
        this.email,
        this.password
      );

      if (result.verificationRequired) {
        this.step = 'verify';
        this.verificationEmailSent = result.verificationEmailSent;
        this.password = '';
        return;
      }

      await this.router.navigate(['/dashboard']);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? '';

      if (code === 'auth/email-already-in-use') {
        this.step = 'password';
        this.allowAssign = false;
        this.errorMessage =
          'Ese correo ya tiene una cuenta. Si ya tiene contraseña, ingresala. Si es una cuenta de Google, eliminá el usuario en Firebase Console → Authentication → Users.';
      } else {
        this.errorMessage = this.mapAuthError(error);
      }
    } finally {
      this.emailLoading = false;
    }
  }

  async checkVerification(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';
    this.emailLoading = true;

    try {
      const verified = await this.authService.completeEmailVerification();

      if (!verified) {
        this.errorMessage =
          'Todavía no verificaste tu correo. Abrí el enlace que te enviamos y volvé a tocar “Ya verifiqué”.';
        return;
      }

      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
    }
  }

  async resendVerification(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';
    this.emailLoading = true;

    try {
      await this.authService.resendVerificationEmail();
      this.verificationEmailSent = true;
      this.infoMessage = 'Te enviamos otro correo de verificación.';
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
    }
  }

  async resetAccount(): Promise<void> {
    try {
      await this.authService.signOutSilently();
    } catch {
      // Si no había sesión, no hay nada que cerrar.
    }

    this.step = 'email';
    this.email = '';
    this.password = '';
    this.allowAssign = false;
    this.verificationEmailSent = null;
    this.errorMessage = '';
    this.infoMessage = '';
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
      ACCESS_CONFIG_MISSING:
        'Falta la lista de acceso en Firestore. Creá el documento config/access con el campo allowedEmails.',
      ACCESS_CONFIG_INVALID:
        'La lista de acceso está mal configurada. allowedEmails debe ser un array de correos.',
      ACCESS_CHECK_FAILED:
        'No se pudo verificar la lista de acceso. Revisá que firestore.rules esté publicado y tu conexión.',
      NOT_AUTHENTICATED: 'No hay una sesión activa. Intentá de nuevo.',
      EMAIL_NOT_VERIFIED:
        'Verificá tu correo antes de entrar. Abrí el enlace que te enviamos.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/user-not-found':
        'No existe una cuenta con ese correo. Volvé a empezar y usá “Asignar contraseña”.',
      'auth/email-already-in-use':
        'Ese correo ya tiene una cuenta. Si es una cuenta de Google, eliminala en Firebase Console → Authentication → Users y volvé a asignar la contraseña; si ya tiene contraseña, usá “Ingresar”.',
      'auth/weak-password':
        'La contraseña debe tener al menos 6 caracteres.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/requires-recent-login':
        'Volvé a iniciar sesión para completar esta acción.',
      'auth/operation-not-allowed':
        'Habilitá Email/Password en Firebase Authentication.',
      'auth/unauthorized-domain':
        'Este dominio no está autorizado en Firebase Authentication. Agregalo en Authentication → Settings → Authorized domains.',
      'auth/network-request-failed':
        'Sin conexión. Verificá tu conexión a internet.',
      'auth/internal-error':
        'Firebase devolvió un error interno. Intentá de nuevo.',
      'auth/invalid-email': 'El correo electrónico no es válido.',
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
