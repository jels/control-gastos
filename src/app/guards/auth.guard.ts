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

    try {
      await this.accessService.assertAllowed();
    } catch (error) {
      const code =
        error instanceof Error ? error.message : 'ACCESS_CHECK_FAILED';

      await this.authService.signOutSilently();
      this.authService.setAuthError(code);

      return this.router.createUrlTree(['/login']);
    }

    // Una sesión vieja sin contraseña debe pasar por el login para
    // ingresar o crear una contraseña antes de entrar al dashboard.
    if (!(await this.authService.hasPasswordSession())) {
      return this.router.createUrlTree(['/login']);
    }

    return true;
  }
}
