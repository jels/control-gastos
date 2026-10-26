import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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

type LoginStep = 'email' | 'password' | 'assign';

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

              <button
                pButton
                type="button"
                outlined
                severity="secondary"
                class="w-full"
                [disabled]="emailLoading"
                (click)="startAssign()"
              >
                <i class="pi pi-key"></i>
                Crear contraseña
              </button>

              <button
                pButton
                type="button"
                text
                severity="secondary"
                class="w-full"
                [disabled]="emailLoading"
                (click)="forgotPassword()"
              >
                <i class="pi pi-question-circle"></i>
                Olvidé mi contraseña
              </button>

              <button
                pButton
                type="button"
                text
                severity="secondary"
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
                Creá una contraseña para tu cuenta. Si ya tenías una, usá “Ya
                tengo contraseña”.
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
                  Crear cuenta e ingresar
                }
              </button>

              <button
                pButton
                type="button"
                text
                severity="secondary"
                class="w-full"
                [disabled]="emailLoading"
                (click)="forgotPassword()"
              >
                Olvidé mi contraseña
              </button>

              <button
                pButton
                type="button"
                text
                severity="secondary"
                class="w-full"
                [disabled]="emailLoading"
                (click)="goToPassword()"
              >
                Ya tengo contraseña
              </button>

              <button
                pButton
                type="button"
                text
                severity="secondary"
                class="w-full"
                [disabled]="emailLoading"
                (click)="resetAccount()"
              >
                Usar otra cuenta
              </button>
            </div>
          }

          @if (infoMessage) {
            <p-message severity="info">{{ infoMessage }}</p-message>
          }

          @if (errorMessage) {
            <p-message severity="error">{{ errorMessage }}</p-message>
          }

          <small class="text-500 text-center">
            Solo pueden entrar las cuentas autorizadas en
            <code>config/access</code>. Cada cuenta tiene su propia casa y sus
            gastos no se mezclan con los de otras cuentas.
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
  errorMessage = '';
  infoMessage = '';
  readonly firebaseConfigured = isFirebaseConfigured();

  constructor(
    private authService: AuthService,
    private accessService: AccessService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    const authError = this.authService.consumeAuthError();
    const session = await this.authService.getSession();

    if (session) {
      this.email = session.email;

      try {
        await this.accessService.assertAllowed();

        // La app solo admite correo y contraseña. Si quedó una sesión
        // vieja sin contraseña, se cierra y se pide ingresar de nuevo.
        if (!(await this.authService.hasPasswordSession())) {
          await this.authService.signOutSilently();
          this.step = 'email';
          this.errorMessage =
            'Tu sesión anterior no tiene contraseña. Ingresá con correo y contraseña. Si el correo ya existe en Firebase con otro método de acceso, eliminá ese usuario en Firebase Console → Authentication → Users y volvé a crear la contraseña.';
          this.refreshView();
          return;
        }

        await this.router.navigate(['/dashboard']);
      } catch (error) {
        await this.authService.signOutSilently();
        this.errorMessage = this.mapAuthError(error);
        this.refreshView();
      }

      return;
    }

    if (authError) {
      this.errorMessage = this.mapAuthError(new Error(authError));
    }

    this.refreshView();
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
      // Primera verificación: el correo debe estar en config/access.
      let allowed: boolean;

      try {
        allowed = await this.accessService.isEmailAllowed(normalized);
      } catch (error) {
        this.errorMessage = this.mapAuthError(error);
        return;
      }

      if (!allowed) {
        this.errorMessage =
          'Este correo no está autorizado. Pedile al administrador que lo agregue a config/access.allowedEmails.';
        return;
      }

      this.email = normalized;
      this.password = '';

      // Segunda verificación: ¿ya tiene contraseña o hay que crearla?
      // El índice `acceso/{email}` es la única fuente para esta decisión.
      if (await this.authService.hasPasswordRecord(normalized)) {
        this.step = 'password';
        this.infoMessage = 'Ingresá la contraseña de tu cuenta.';
        return;
      }

      this.step = 'assign';
      this.infoMessage =
        'Creá una contraseña para tu cuenta. Si ya tenías una, usá “Ya tengo contraseña”.';
    } finally {
      this.checkingEmail = false;
      this.refreshView();
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
      await this.authService.loginWithEmailPassword(
        this.email,
        this.password
      );
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);

      if (this.isInvalidCredential(error)) {
        this.errorMessage +=
          ' Si todavía no creaste una contraseña, usá “Crear contraseña”. Si la olvidaste, usá “Olvidé mi contraseña”.';
      }
    } finally {
      this.emailLoading = false;
      this.refreshView();
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
      await this.authService.registerWithEmailPassword(
        this.email,
        this.password
      );
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      const code = this.errorCode(error);

      if (code === 'auth/email-already-in-use') {
        // Puede ser una cuenta existente cuyo índice `acceso` no está
        // creado (por ejemplo, cuentas de la versión anterior). Si la
        // contraseña ingresada es la correcta, se inicia sesión.
        try {
          await this.authService.loginWithEmailPassword(
            this.email,
            this.password
          );
          await this.router.navigate(['/dashboard']);
          return;
        } catch (loginError) {
          const loginCode = this.errorCode(loginError);

          if (
            loginCode !== 'auth/invalid-credential' &&
            loginCode !== 'auth/invalid-login-credentials' &&
            loginCode !== 'auth/wrong-password' &&
            loginCode !== 'auth/user-not-found'
          ) {
            this.errorMessage = this.mapAuthError(loginError);
            return;
          }
        }

        const hasPassword = await this.authService.hasPasswordRecord(
          this.email
        );

        this.password = '';

        if (hasPassword) {
          this.step = 'password';
          this.errorMessage =
            'Ese correo ya tiene una contraseña. Ingresala o usá “Olvidé mi contraseña”.';
        } else {
          this.step = 'assign';
          this.errorMessage =
            'Ese correo ya existe en Firebase con otro método de acceso y no tiene contraseña. Para usar contraseña, eliminá ese usuario en Firebase Console → Authentication → Users y volvé a intentar. Si ya tenías contraseña, usá “Ya tengo contraseña” o “Olvidé mi contraseña”.';
        }
      } else {
        this.errorMessage = this.mapAuthError(error);
      }
    } finally {
      this.emailLoading = false;
      this.refreshView();
    }
  }

  async forgotPassword(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.validateEmail()) {
      return;
    }

    this.emailLoading = true;

    try {
      await this.authService.sendPasswordReset(this.email);
      this.infoMessage =
        'Si el correo tiene una cuenta con contraseña, te enviamos un enlace para restablecerla. Revisá también spam.';
    } catch (error) {
      this.errorMessage = this.mapAuthError(error);
    } finally {
      this.emailLoading = false;
      this.refreshView();
    }
  }

  startAssign(): void {
    this.errorMessage = '';
    this.infoMessage = 'Creá una contraseña para este correo.';
    this.password = '';
    this.step = 'assign';
    this.refreshView();
  }

  goToPassword(): void {
    this.errorMessage = '';
    this.infoMessage = 'Ingresá la contraseña de tu cuenta.';
    this.password = '';
    this.step = 'password';
    this.refreshView();
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
    this.errorMessage = '';
    this.infoMessage = '';
    this.refreshView();
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // La vista pudo haber sido destruida por una navegación.
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

  private isInvalidCredential(error: unknown): boolean {
    const code = this.errorCode(error);
    return (
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    );
  }

  private errorCode(error: unknown): string {
    return (
      (error as { code?: string } | null)?.code ??
      (error instanceof Error ? error.message : '')
    );
  }

  private mapAuthError(error: unknown): string {
    const key = this.errorCode(error);

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
      ACCESS_CONFIG_CASE:
        'El correo está en la lista pero escrito con mayúsculas. Guardalo en minúsculas en config/access.allowedEmails.',
      ACCESS_CHECK_FAILED:
        'No se pudo leer la lista de acceso. Publicá las reglas de firestore.rules en Firebase Console y revisá tu conexión.',
      NOT_AUTHENTICATED: 'No hay una sesión activa. Intentá de nuevo.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/invalid-login-credentials':
        'Correo o contraseña incorrectos.',
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/user-not-found':
        'No existe una cuenta con ese correo. Volvé a empezar y usá “Crear contraseña”.',
      'auth/email-already-in-use':
        'Ese correo ya existe en Firebase. Si ya tenía contraseña, usá “Ya tengo contraseña” o “Olvidé mi contraseña”. Si la cuenta se creó con otro método de acceso, eliminá el usuario en Firebase Console → Authentication → Users y volvé a crear la contraseña.',
      'auth/weak-password':
        'La contraseña debe tener al menos 6 caracteres.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/requires-recent-login':
        'Volvé a iniciar sesión para completar esta acción.',
      'auth/operation-not-allowed':
        'El proveedor Email/Password está deshabilitado. En Firebase Console → Authentication → Sign-in method, habilitá Email/Password y guardá los cambios.',
      'auth/unauthorized-domain':
        'Este dominio no está autorizado en Firebase Authentication. Agregalo en Authentication → Settings → Authorized domains.',
      'auth/network-request-failed':
        'Sin conexión. Verificá tu conexión a internet.',
      unavailable:
        'Sin conexión con Firestore. Verificá tu conexión a internet.',
      'permission-denied':
        'Firestore rechazó la operación. Publicá firestore.rules y verificá que tu correo esté en config/access.allowedEmails.',
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
