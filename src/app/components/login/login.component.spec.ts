import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { AccessService } from '../../services/access.service';

describe('LoginComponent', () => {
  let auth: {
    consumeAuthError: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    hasPasswordProvider: ReturnType<typeof vi.fn>;
    hasGoogleProvider: ReturnType<typeof vi.fn>;
    getCurrentUserEmail: ReturnType<typeof vi.fn>;
    hasPasswordRecord: ReturnType<typeof vi.fn>;
    getSignInMethods: ReturnType<typeof vi.fn>;
    loginWithEmailPassword: ReturnType<typeof vi.fn>;
    registerWithEmailPassword: ReturnType<typeof vi.fn>;
    linkPasswordWithGoogle: ReturnType<typeof vi.fn>;
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
      hasPasswordProvider: vi.fn().mockReturnValue(true),
      hasGoogleProvider: vi.fn().mockReturnValue(false),
      getCurrentUserEmail: vi.fn().mockReturnValue(''),
      hasPasswordRecord: vi.fn().mockResolvedValue(false),
      getSignInMethods: vi.fn().mockResolvedValue([]),
      loginWithEmailPassword: vi.fn().mockResolvedValue(undefined),
      registerWithEmailPassword: vi.fn().mockResolvedValue(undefined),
      linkPasswordWithGoogle: vi.fn().mockResolvedValue(undefined),
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
    expect(auth.getSignInMethods).not.toHaveBeenCalled();
  });

  it('shows the password step when the access index says it has a password', async () => {
    const component = await createComponent();
    auth.hasPasswordRecord.mockResolvedValue(true);

    component.email = 'persona@example.com';
    await component.checkEmail();

    expect(component.step).toBe('password');
    expect(component.email).toBe('persona@example.com');
    expect(auth.getSignInMethods).not.toHaveBeenCalled();
  });

  it('shows the password step when Firebase reports a password method', async () => {
    const component = await createComponent();
    auth.hasPasswordRecord.mockResolvedValue(false);
    auth.getSignInMethods.mockResolvedValue(['password']);

    component.email = 'persona@example.com';
    await component.checkEmail();

    expect(component.step).toBe('password');
  });

  it('shows the assign step when the email has no account', async () => {
    const component = await createComponent();
    auth.getSignInMethods.mockResolvedValue([]);

    component.email = 'nueva@example.com';
    await component.checkEmail();

    expect(component.step).toBe('assign');
    expect(component.showGoogleLink).toBe(false);
  });

  it('offers Google linking when the email only has a Google account', async () => {
    const component = await createComponent();
    auth.getSignInMethods.mockResolvedValue(['google.com']);

    component.email = 'google@example.com';
    await component.checkEmail();

    expect(component.step).toBe('assign');
    expect(component.showGoogleLink).toBe(true);
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

  it('offers Google linking when creating an account finds a Google-only user', async () => {
    const component = await createComponent();
    auth.registerWithEmailPassword.mockRejectedValue({
      code: 'auth/email-already-in-use',
    });
    auth.loginWithEmailPassword.mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    auth.hasPasswordRecord.mockResolvedValue(false);

    component.email = 'google@example.com';
    component.password = 'secreta123';
    await component.assignPassword();

    expect(component.step).toBe('assign');
    expect(component.showGoogleLink).toBe(true);
    expect(component.errorMessage).toContain('Google');
  });

  it('links a password with Google and opens the dashboard', async () => {
    const component = await createComponent();
    component.email = 'google@example.com';
    component.password = 'secreta123';

    await component.linkPasswordWithGoogle();

    expect(auth.linkPasswordWithGoogle).toHaveBeenCalledWith(
      'google@example.com',
      'secreta123'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
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

  it('opens the dashboard directly when there is an authorized session', async () => {
    auth.getSession.mockResolvedValue({
      uid: 'uid-1',
      email: 'persona@example.com',
      displayName: 'Persona',
      emailVerified: false,
    });

    await createComponent();

    expect(access.assertAllowed).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('asks for a password when the persisted session is Google-only', async () => {
    auth.getSession.mockResolvedValue({
      uid: 'uid-1',
      email: 'google@example.com',
      displayName: 'Google',
      emailVerified: true,
    });
    auth.hasPasswordProvider.mockReturnValue(false);

    const component = await createComponent();

    expect(component.step).toBe('assign');
    expect(component.showGoogleLink).toBe(true);
    expect(router.navigate).not.toHaveBeenCalledWith(['/dashboard']);
  });

  it('links the password directly when the persisted session is Google-only', async () => {
    auth.getSession.mockResolvedValue({
      uid: 'uid-1',
      email: 'google@example.com',
      displayName: 'Google',
      emailVerified: true,
    });
    auth.hasPasswordProvider.mockReturnValue(false);
    auth.hasGoogleProvider.mockReturnValue(true);
    auth.getCurrentUserEmail.mockReturnValue('google@example.com');

    const component = await createComponent();
    component.password = 'secreta123';
    await component.assignPassword();

    expect(auth.linkPasswordWithGoogle).toHaveBeenCalledWith(
      'google@example.com',
      'secreta123'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
