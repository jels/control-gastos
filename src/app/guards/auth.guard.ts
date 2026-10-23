import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AccessService } from '../services/access.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private readonly authService = inject(AuthService);
  private readonly accessService = inject(AccessService);
  private readonly router = inject(Router);

  async canActivate(): Promise<boolean | UrlTree> {
    const session = await this.authService.getSession();

    if (!session) {
      return this.router.createUrlTree(['/login']);
    }

    // Las reglas de Firestore exigen email_verified. No cerramos la sesión:
    // el login muestra la pantalla para verificar o reenviar el correo.
    if (!session.emailVerified) {
      this.authService.setAuthError('EMAIL_NOT_VERIFIED');
      return this.router.createUrlTree(['/login']);
    }

    try {
      await this.accessService.assertAllowed();
      return true;
    } catch (error) {
      const code =
        error instanceof Error ? error.message : 'ACCESS_CHECK_FAILED';

      await this.authService.signOutSilently();
      this.authService.setAuthError(code);

      return this.router.createUrlTree(['/login']);
    }
  }
}
