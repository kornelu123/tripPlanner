# iPhone Safari and installed PWA authentication checklist

Run this checklist on a physical, currently supported iPhone against the HTTPS production deployment. Use a test Apple ID and remove test passkeys afterward.

## Safari

- [ ] Open the canonical production URL and confirm registration offers Face ID/iCloud Keychain and completes without an RP/domain warning.
- [ ] Cancel Face ID during registration and login; confirm the page remains usable and reports cancellation without creating a credential or session.
- [ ] Sign out, sign in with the saved passkey, reload, and confirm the HTTP-only session persists.
- [ ] Request a recovery email, open it in Mail, and confirm it signs in once; reopening the same link must show that it was used.
- [ ] Sign in with Apple using both “Share My Email” and “Hide My Email”; confirm the displayed relay address is labelled and the first-login name persists on later logins where Apple omits it.
- [ ] Link and unlink Apple. Confirm unlinking is blocked when it is the last sign-in method.
- [ ] Register a second passkey, inspect both entries, revoke another session, and confirm the revoked browser is signed out.
- [ ] Attempt to open and mutate a trip owned by another test account; confirm no trip data is returned.

## Saved to Home Screen

- [ ] In Safari choose **Share → Add to Home Screen**, launch Roamly from its icon, and confirm it opens standalone rather than in a Safari tab.
- [ ] Sign in from the installed app with a passkey and confirm the Face ID sheet returns to the standalone app.
- [ ] Force-quit and reopen the app; confirm the authenticated session persists.
- [ ] Sign out in Safari and confirm the installed app is signed out after reload (the cookie store is shared for the same origin).
- [ ] Follow a magic link from Mail and return to the installed app; confirm refreshing recognizes the new session.
- [ ] With the phone offline, launch the app and confirm cached public shell behavior never displays previously authenticated trip API data.
