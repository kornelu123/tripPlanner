'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type User = { id: string; displayName: string; email: string };
type MapSummary = {
  id: string;
  name: string;
  ownerId: string;
  role: 'owner' | 'editor' | 'viewer';
  updatedAt: string;
};
type Member = {
  userId: string;
  email: string;
  displayName: string;
  role: 'editor' | 'viewer';
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message ?? 'Request failed.');
  return body;
}

export function MapDashboard({ user }: { user: User }) {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [newName, setNewName] = useState('');
  const [sharing, setSharing] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor');
  const [message, setMessage] = useState('');

  async function loadMaps() {
    setMaps(await requestJson('/api/trips'));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial remote data sync
    void loadMaps().catch((error: Error) => setMessage(error.message));
  }, []);

  async function createMap(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await requestJson('/api/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      setMaps((current) => [created, ...current]);
      setNewName('');
      setMessage('Map created.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function renameMap(map: MapSummary) {
    const name = window.prompt('Map name', map.name)?.trim();
    if (!name || name === map.name) return;
    try {
      const updated = await requestJson(`/api/trips/${map.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setMaps((current) =>
        current.map((item) =>
          item.id === map.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function deleteMap(map: MapSummary) {
    if (!window.confirm(`Delete “${map.name}”? This cannot be undone.`)) return;
    try {
      await requestJson(`/api/trips/${map.id}`, { method: 'DELETE' });
      setMaps((current) => current.filter(({ id }) => id !== map.id));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function openSharing(mapId: string) {
    try {
      setSharing(mapId);
      setMembers(await requestJson(`/api/trips/${mapId}/members`));
      setMessage('');
    } catch (error) {
      setSharing(null);
      setMessage((error as Error).message);
    }
  }

  async function shareMap(event: React.FormEvent) {
    event.preventDefault();
    if (!sharing) return;
    try {
      const member = await requestJson(`/api/trips/${sharing}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: shareEmail, role: shareRole }),
      });
      setMembers((current) => [...current, member]);
      setShareEmail('');
      setMessage('Map shared.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function removeMember(userId: string) {
    if (!sharing) return;
    try {
      await requestJson(
        `/api/trips/${sharing}/members?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      );
      setMembers((current) => current.filter((item) => item.userId !== userId));
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <main className="dashboard">
      <nav className="dashboard-nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          Roamly
        </Link>
        <div>
          <span>{user.displayName}</span>
          <Link href="/account">Account</Link>
        </div>
      </nav>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Your map library</p>
          <h1>Plan together, go anywhere.</h1>
          <p>
            Create as many maps as you need and invite others to view or edit.
          </p>
        </div>
        <form className="create-map" onSubmit={createMap}>
          <label htmlFor="map-name">New map name</label>
          <div>
            <input
              id="map-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={200}
              placeholder="Summer in Lisbon"
              required
            />
            <button type="submit">Create map</button>
          </div>
        </form>
      </header>
      <p className="dashboard-message" role="status">
        {message}
      </p>
      {maps.length ? (
        <section className="map-grid" aria-label="Your maps">
          {maps.map((map) => (
            <article className="map-card" key={map.id}>
              <div className="map-art" aria-hidden="true">
                <span>⌖</span>
              </div>
              <div className="map-card-body">
                <span className="role-badge">{map.role}</span>
                <h2>{map.name}</h2>
                <p>Updated {new Date(map.updatedAt).toLocaleDateString()}</p>
                <div className="map-actions">
                  <Link href={`/trips/${map.id}`}>Open map</Link>
                  {map.role !== 'viewer' && (
                    <button onClick={() => renameMap(map)}>Rename</button>
                  )}
                  {map.role === 'owner' && (
                    <button onClick={() => openSharing(map.id)}>Share</button>
                  )}
                  {map.role === 'owner' && (
                    <button className="danger" onClick={() => deleteMap(map)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-maps">
          <span aria-hidden="true">⌖</span>
          <h2>Create your first map</h2>
          <p>Your maps and maps shared with you will appear here.</p>
        </section>
      )}
      {sharing && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
          >
            <button
              className="dialog-close"
              aria-label="Close sharing"
              onClick={() => setSharing(null)}
            >
              ×
            </button>
            <p className="eyebrow">Collaborate</p>
            <h2 id="share-title">Share this map</h2>
            <form onSubmit={shareMap}>
              <label>
                Email
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                  placeholder="friend@example.com"
                  required
                />
              </label>
              <label>
                Access
                <select
                  value={shareRole}
                  onChange={(event) =>
                    setShareRole(event.target.value as 'editor' | 'viewer')
                  }
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
              </label>
              <button type="submit">Share map</button>
            </form>
            <h3>People with access</h3>
            {members.length ? (
              <ul>
                {members.map((member) => (
                  <li key={member.userId}>
                    <span>
                      <strong>{member.displayName}</strong>
                      <small>
                        {member.email} · {member.role}
                      </small>
                    </span>
                    <button onClick={() => removeMember(member.userId)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No one else has access yet.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
