import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
  ],
  template: `
    <div
      class="flex align-items-center justify-content-center min-h-screen bg-gray-100"
    >
      <p-card header="Control de Gastos" class="w-full max-w-25rem">
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label for="username">Usuario</label>
            <input
              pInputText
              id="username"
              [(ngModel)]="username"
              placeholder="esposo / esposa"
              (keyup.enter)="login()"
            />
          </div>

          <div class="flex flex-column gap-2">
            <label for="password">Contraseña</label>
            <p-password
              [(ngModel)]="password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              (keyup.enter)="login()"
            ></p-password>
          </div>

          <p-message
            *ngIf="errorMessage"
            severity="error"
            [text]="errorMessage"
          ></p-message>

          <p-button
            label="Ingresar"
            icon="pi pi-sign-in"
            (onClick)="login()"
            styleClass="w-full"
          ></p-button>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    if (this.authService.login(this.username, this.password)) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage = 'Usuario o contraseña incorrectos';
    }
  }
}
