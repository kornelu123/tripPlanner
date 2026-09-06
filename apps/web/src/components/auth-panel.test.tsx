// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SignInPanel } from './auth-panel';

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

describe('SignInPanel', () => {
  it('renders login controls and a registration link', () => {
    render(<SignInPanel />);

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Log in with a passkey' }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Create an account' })
        .getAttribute('href'),
    ).toBe('/register');
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('renders registration controls and a login link', () => {
    render(<SignInPanel mode="register" />);

    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Create account with a passkey' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Log in' }).getAttribute('href'),
    ).toBe('/login');
    expect(screen.getByLabelText('Name')).toBeTruthy();
  });
});
