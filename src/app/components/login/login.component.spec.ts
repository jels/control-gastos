import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { AccessService } from '../../services/access.service';

describe('LoginComponent', () => {
  let auth: {
    consumeAuthError: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    hasPasswordSession: ReturnType<typeof vi.fn>;
    hasPasswordRecord: ReturnType<typeof vi.fn>;
    loginWithEmailPassword: ReturnType<typeof vi.fn>;
    registerWithEmailPassword: ReturnType<typeof vi.fn>;
    sendPasswordReset: ReturnType<typeof vi.fn>;
    signOutSilently: ReturnType<typeof vi.fn>;
  };
  let access: {
    isEmailAllowed: ReturnType<typeof vi.fn>;
    assertAllowed: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = {
      consumeAuthError: vi.fn().mockReturnValue(''),
      getSession: vi.fn().mockResolvedValue(null),
      hasPasswordSession: vi.fn().mockResolvedValue(true),
      hasPasswordRecord: vi.fn().mockResolvedValue(false),
      loginWithEmailPassword: vi.fn().mockResolvedValue(undefined),
      registerWithEmailPassword: vi.fn().mockResolvedValue(undefined),
      sendPasswordReset: vi.fn().mockResolvedValue(undefined),
      signOutSilently: vi.fn().mockResolvedValue(undefined),
    };

    access = {
      isEmailAllowed: vi.fn().mockResolvedValue(true),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };

    router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AccessService, useValue: access },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  async function createComponent(): Promise<LoginComponent> {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('starts with only the email step', async () => {
    const component = await createComponent();

    expect(component.step).toBe('email');
  });

  it('rejects an email that is not in config/access', async () => {
    const component = await createComponent();
    access.isEmailAllowed.mockResolvedValue(false);

    component.email = 'desconocido@example.com';
    await component.checkEmail();

    expect(component.step).toBe('email');
    expect(component.errorMessage).toContain('no está autorizado');
  });

  it('shows the password step when the access index says it has a password', async () => {
    const component = await createComponent();
    auth.hasPasswordRecord.mockResolvedValue(true);

    component.email = 'persona@example.com';
    await component.checkEmail();

    expect(component.step).toBe('password');
    expect(component.email).toBe('persona@example.com');
  });

  it('shows the assign step when the email has no password', async () => {
    const component = await createComponent();

    component.email = 'nueva@example.com';
    await component.checkEmail();

    expect(component.step).toBe('assign');
  });

  it('logs in with email and password and opens the dashboard', async () => {
    const component = await createComponent();
    component.email = 'persona@example.com';
    component.password = 'secreta123';

    await component.loginWithPassword();

    expect(auth.loginWithEmailPassword).toHaveBeenCalledWith(
      'persona@example.com',
      'secreta123'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('returns to the password step when creating an account finds an existing password', async () => {
    const component = await createComponent();
    auth.registerWithEmailPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });
    auth.loginWithEmailPassword.mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    auth.hasPasswordRecord.mockResolvedValue(true);

    component.email = 'persona@example.com';
    component.password = 'secreta123';
    await component.assignPassword();

    expect(component.step).toBe('password');
    expect(component.errorMessage).toContain('ya tiene una contraseña');
  });

  it('logs in automatically when create fails but the password is correct', async () => {
    const component = await createComponent();
    auth.registerWithEmailPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });
    auth.loginWithEmailPassword.mockResolvedValue(undefined);

    component.email = 'persona@example.com';
    component.password = 'secreta123';
    await component.assignPassword();

    expect(auth.loginWithEmailPassword).toHaveBeenCalledWith(
      'persona@example.com',
      'secreta123'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('shows an error when creating an account finds an existing account without password', async () => {
    const component = await createComponent();
    auth.registerWithEmailPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });
    auth.loginWithEmailPassword.mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    auth.hasPasswordRecord.mockResolvedValue(false);

    component.email = 'existente@example.com';
    component.password = 'secreta123';
    await component.assignPassword();

    expect(component.step).toBe('assign');
    expect(component.errorMessage).toContain('otro método de acceso');
    expect(component.errorMessage).toContain('Firebase Console');
  });

  it('sends a password reset email', async () => {
    const component = await createComponent();
    component.email = 'persona@example.com';

    await component.forgotPassword();

    expect(auth.sendPasswordReset).toHaveBeenCalledWith(
      'persona@example.com'
    );
    expect(component.infoMessage).toContain('enviamos');
  });

  it('returns to the empty email step with Usar otra cuenta', async () => {
    const component = await createComponent();
    component.step = 'password';
    component.email = 'persona@example.com';
    component.password = 'secreta123';

    await component.resetAccount();

    expect(auth.signOutSilently).toHaveBeenCalled();
    expect(component.step).toBe('email');
    expect(component.email).toBe('');
    expect(component.password).toBe('');
  });

  it('opens the dashboard directly when there is an authorized session with password', async () => {
    auth.getSession.mockResolvedValue({
      uid: 'uid-1',
      email: 'persona@example.com',
      displayName: 'Persona',
    });

    await createComponent();

    expect(access.assertAllowed).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('signs out a persisted session that has no password', async () => {
    auth.getSession.mockResolvedValue({
      uid: 'uid-1',
      email: 'persona@example.com',
      displayName: 'Persona',
    });
    auth.hasPasswordSession.mockResolvedValue(false);

    const component = await createComponent();

    expect(auth.signOutSilently).toHaveBeenCalled();
    expect(component.step).toBe('email');
    expect(component.errorMessage).toContain('no tiene contraseña');
    expect(router.navigate).not.toHaveBeenCalledWith(['/dashboard']);
  });
});
