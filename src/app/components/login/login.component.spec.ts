import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { AccessService } from '../../services/access.service';

describe('LoginComponent', () => {
  let auth: {
    consumeAuthError: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    hasPasswordRecord: ReturnType<typeof vi.fn>;
    getSignInMethods: ReturnType<typeof vi.fn>;
    loginWithEmailPassword: ReturnType<typeof vi.fn>;
    registerWithEmailPassword: ReturnType<typeof vi.fn>;
    completeEmailVerification: ReturnType<typeof vi.fn>;
    resendVerificationEmail: ReturnType<typeof vi.fn>;
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
      hasPasswordRecord: vi.fn().mockResolvedValue(false),
      getSignInMethods: vi.fn().mockResolvedValue([]),
      loginWithEmailPassword: vi.fn(),
      registerWithEmailPassword: vi.fn(),
      completeEmailVerification: vi.fn(),
      resendVerificationEmail: vi.fn(),
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
    expect(component.allowAssign).toBe(false);
    expect(component.email).toBe('persona@example.com');
    expect(auth.getSignInMethods).not.toHaveBeenCalled();
  });

  it('falls back to Firebase methods when the access index is missing', async () => {
    const component = await createComponent();
    auth.hasPasswordRecord.mockResolvedValue(false);
    auth.getSignInMethods.mockResolvedValue(['password']);

    component.email = 'persona@example.com';
    await component.checkEmail();

    expect(component.step).toBe('password');
    expect(component.allowAssign).toBe(false);
  });

  it('shows the assign step when the email has no account', async () => {
    const component = await createComponent();
    auth.getSignInMethods.mockResolvedValue([]);

    component.email = 'nueva@example.com';
    await component.checkEmail();

    expect(component.step).toBe('assign');
  });

  it('asks for verification when the password login needs it', async () => {
    const component = await createComponent();
    auth.loginWithEmailPassword.mockResolvedValue({
      verificationRequired: true,
      verificationEmailSent: true,
    });

    component.email = 'persona@example.com';
    component.password = 'secreta123';
    await component.loginWithPassword();

    expect(component.step).toBe('verify');
  });

  it('asks for verification after creating a password account', async () => {
    const component = await createComponent();
    auth.registerWithEmailPassword.mockResolvedValue({
      verificationRequired: true,
      verificationEmailSent: true,
    });

    component.email = 'nueva@example.com';
    component.password = 'secreta123';
    await component.assignPassword();

    expect(component.step).toBe('verify');
    expect(component.email).toBe('nueva@example.com');
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
});
