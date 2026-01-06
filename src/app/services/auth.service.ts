import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUser: string | null = null;

  constructor(private router: Router) {
    this.currentUser = localStorage.getItem('currentUser');
  }

  login(username: string, password: string): boolean {
    const users = environment.users as any;
    if (users[username] && users[username] === password) {
      this.currentUser = username;
      localStorage.setItem('currentUser', username);
      return true;
    }
    return false;
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  getCurrentUser(): string {
    return this.currentUser || '';
  }
}
