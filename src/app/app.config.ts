import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import Aura from '@openng/optimus-ui-themes/aura';
import { provideOptimus } from '@openng/optimus-ui/config';
import { routes } from './app.routes';
import { provideFirebase } from './firebase.providers';
import { AuthService } from './services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideOptimus({
      theme: {
        preset: Aura,
      },
    }),
    provideFirebase(),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      await auth.handleEmailLinkResult();
      await auth.handleRedirectResult();
    }),
  ],
};
