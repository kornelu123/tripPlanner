'use client';

import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { useEffect, useState } from 'react';

type Credential = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};
type Session = {
  id: string;
  current: boolean;
  userAgent: string | null;
  lastSeenAt: string;
};

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message ?? 'Request failed.');
  return body;
}

export function SignInPanel({
  mode = 'login',
}: {
  mode?: 'login' | 'register';
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  async function passkey(register: boolean) {
    try {
      setMessage('');
      const base = `/api/auth/passkeys/${register ? 'register' : 'login'}`;
      const created = await jsonFetch(`${base}/options`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: register
          ? JSON.stringify({ email, displayName: name })
          : undefined,
      });
      const credential = register
        ? await startRegistration({ optionsJSON: created.options })
        : await startAuthentication({ optionsJSON: created.options });
      await jsonFetch(`${base}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeId: created.challengeId,
          response: credential,
          name: 'Primary passkey',
        }),
      });
      location.href = '/account';
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Passkey request cancelled.'
          : error instanceof Error
            ? error.message
            : 'Authentication failed.',
      );
    }
  }
  async function recover() {
    try {
      await jsonFetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setMessage('If that account exists, a sign-in link is on its way.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not send link.',
      );
    }
  }
  return (
    <div className="auth-card">
      <h1>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
      <p>
        {mode === 'register'
          ? 'Create a passkey for secure, password-free access.'
          : 'Use your passkey for phishing-resistant login.'}
      </p>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </label>
      {mode === 'register' && (
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </label>
      )}
      <div className="auth-actions">
        <button onClick={() => passkey(mode === 'register')}>
          {mode === 'register'
            ? 'Create account with a passkey'
            : 'Log in with a passkey'}
        </button>
        <a className="apple-button" href="/api/auth/apple/start">
          {mode === 'register' ? 'Sign up with Apple' : 'Log in with Apple'}
        </a>
        {mode === 'login' && (
          <button className="link-button" onClick={recover}>
            Email me a login link
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      <p className="auth-switch">
        {mode === 'register' ? 'Already have an account?' : 'New to Roamly?'}{' '}
        <a href={mode === 'register' ? '/login' : '/register'}>
          {mode === 'register' ? 'Log in' : 'Create an account'}
        </a>
      </p>
    </div>
  );
}

export function AccountPanel() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [apple, setApple] = useState<{
    linked: boolean;
    email?: string;
    isPrivateRelay?: boolean;
  }>({ linked: false });
  const [message, setMessage] = useState('');
  async function load() {
    try {
      const [keys, active, linked] = await Promise.all([
        jsonFetch('/api/account/passkeys'),
        jsonFetch('/api/account/sessions'),
        jsonFetch('/api/account/apple'),
      ]);
      setCredentials(keys);
      setSessions(active);
      setApple(linked);
    } catch {
      location.href = '/signin';
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial remote data sync
    void load();
  }, []);
  async function addPasskey() {
    try {
      const created = await jsonFetch('/api/auth/passkeys/register/options', {
        method: 'POST',
      });
      const credential = await startRegistration({
        optionsJSON: created.options,
      });
      await jsonFetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeId: created.challengeId,
          response: credential,
          name: `Passkey ${credentials.length + 1}`,
        }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Passkey registration cancelled.'
          : error instanceof Error
            ? error.message
            : 'Could not add passkey.',
      );
    }
  }
  async function remove(url: string) {
    try {
      await jsonFetch(url, { method: 'DELETE' });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update account.',
      );
    }
  }
  return (
    <div className="settings">
      <header>
        <div>
          <p className="eyebrow">Security</p>
          <h1>Account settings</h1>
        </div>
        <button
          className="secondary"
          onClick={async () => {
            await jsonFetch('/api/auth/logout', { method: 'POST' });
            location.href = '/signin';
          }}
        >
          Sign out
        </button>
      </header>
      <section>
        <h2>Passkeys</h2>
        <p>Passkeys stay on your devices or password manager.</p>
        <button onClick={addPasskey}>Register another passkey</button>
        {credentials.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.backedUp ? 'Synced passkey' : item.deviceType}</span>
            </div>
            <button
              className="link-button"
              onClick={() =>
                remove(`/api/account/passkeys/${encodeURIComponent(item.id)}`)
              }
            >
              Remove
            </button>
          </article>
        ))}
      </section>
      <section>
        <h2>Sign in with Apple</h2>
        {apple.linked ? (
          <article>
            <div>
              <strong>{apple.email}</strong>
              <span>
                {apple.isPrivateRelay
                  ? 'Apple private relay address'
                  : 'Linked Apple ID'}
              </span>
            </div>
            <button
              className="link-button"
              onClick={() => remove('/api/account/apple')}
            >
              Unlink
            </button>
          </article>
        ) : (
          <a className="apple-button compact" href="/api/auth/apple/start">
            Link Apple login
          </a>
        )}
      </section>
      <section>
        <h2>Sessions</h2>
        <button
          className="secondary"
          onClick={() => remove('/api/account/sessions')}
        >
          Revoke other sessions
        </button>
        {sessions.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.current ? 'This device' : 'Signed-in device'}
              </strong>
              <span>{item.userAgent ?? 'Unknown browser'}</span>
            </div>
            <button
              className="link-button"
              onClick={() => remove(`/api/account/sessions/${item.id}`)}
            >
              Revoke
            </button>
          </article>
        ))}
      </section>
      <section>
        <h2>Delete account</h2>
        <p>
          This permanently deletes your trips, imports, saved routes,
          credentials, and sessions.
        </p>
        <button
          className="link-button"
          onClick={async () => {
            if (!confirm('Permanently delete your account and all trip data?'))
              return;
            await jsonFetch('/api/account', { method: 'DELETE' });
            location.href = '/signin';
          }}
        >
          Delete my account
        </button>
      </section>
      <p role="status">{message}</p>
    </div>
  );
}
