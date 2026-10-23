import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from '@openng/optimus-ui/card';
import { ButtonModule } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';
import { AuthService } from '../../services/auth.service';
import { AccessService } from '../../services/access.service';
import { isFirebaseConfigured } from '../../../environments/firebase.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, MessageModule],
  template: `
    <div
      class="flex align-items-center justify-content-center min-h-screen bg-gray-100"
    >
      <p-card header="Control de Gastos" class="w-full max-w-25rem">
        <div class="flex flex-column gap-3">
          <p-message *ngIf="!firebaseConfigured" severity="warn">
            Firebase no está configurado. Completá
            src/environments/firebase.config.ts con los datos de tu proyecto.
          </p-message>

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

          <p-message *ngIf="errorMessage" severity="error">
            {{ errorMessage }}
          </p-message>

          <small class="text-500 text-center">
            Solo pueden entrar las cuentas autorizadas en
            <code>config/access</code>. Si tu email no está en la lista, la app
            cierra la sesión automáticamente.
          </small>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  loading = false;
  errorMessage = '';
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

  private mapAuthError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    const code = (error as { code?: string } | null)?.code ?? '';
    const key = message || code;

    if (key === 'FIREBASE_NOT_CONFIGURED') {
      return 'Firebase no está configurado. Completá src/environments/firebase.config.ts.';
    }

    const messages: Record<string, string> = {
      EMAIL_NOT_ALLOWED:
        'Esta cuenta de Google no está autorizada. Pedile al administrador que agregue tu email a config/access.allowedEmails en Firestore.',
      ACCESS_CONFIG_MISSING:
        'Falta la lista de acceso en Firestore. Creá el documento config/access con el campo allowedEmails.',
      ACCESS_CONFIG_INVALID:
        'La lista de acceso está mal configurada. allowedEmails debe ser un array de correos.',
      ACCESS_CHECK_FAILED:
        'No se pudo verificar la lista de acceso. Revisá que firestore.rules esté publicado y tu conexión.',
      NOT_AUTHENTICATED: 'No hay una sesión activa. Intentá de nuevo.',
      'auth/popup-closed-by-user': 'Inicio de sesión cancelado.',
      'auth/cancelled-popup-request': 'Inicio de sesión cancelado.',
      'auth/popup-blocked':
        'El navegador bloqueó la ventana de Google. Habilitá las ventanas emergentes e intentá de nuevo.',
      'auth/operation-not-allowed':
        'Habilitá el proveedor Google en Firebase Authentication.',
      'auth/unauthorized-domain':
        'Este dominio no está autorizado en Firebase Authentication. Agregalo en Authentication → Settings → Authorized domains.',
      'auth/account-exists-with-different-credential':
        'Ya existe una cuenta con ese correo usando otro método de acceso.',
      'auth/network-request-failed':
        'Sin conexión. Verificá tu conexión a internet.',
      'auth/internal-error':
        'Firebase devolvió un error interno. Intentá de nuevo.',
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
