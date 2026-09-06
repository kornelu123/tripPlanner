# Production security operations

## Database backups and restore drills

Run `scripts/backup-database.sh` from a scheduler every six hours. `BACKUP_REPOSITORY` must be an off-server S3-compatible bucket with versioning and restricted write credentials; restic encrypts every snapshot using `RESTIC_PASSWORD`. The script retains 7 daily, 5 weekly, and 12 monthly snapshots. Alert when a run fails or the newest snapshot is older than eight hours.

Quarterly, provision an isolated empty database, set `RESTORE_DATABASE_URL`, and run `scripts/restore-database.sh`. Record the snapshot ID, operator, duration, row-count checks, application smoke-test result, and cleanup confirmation in the operations ticket. Never restore over production during a drill.

## Secret rotation

1. Create a replacement in the provider or secret manager without disabling the current value. For database and object-storage credentials, grant only the existing minimum permissions.
2. Update the deployment secret reference, deploy, and verify health, authentication, routing, imports, metrics, and a backup.
3. Revoke the old value and inspect error and audit events for unexpected use. Roll back by restoring the old secret only while it remains valid.
4. Rotate database, Redis, SMTP, Apple, Instagram, metrics, backup-repository, and restic credentials at least every 90 days and immediately after suspected exposure or operator departure. Session signing material or authentication credentials require revoking all active sessions.
5. Record only secret name, owner, version, timestamps, validation outcome, and incident/ticket ID. Never paste secret values into tickets, chat, source control, or logs.

## Monitoring

Scrape `GET /api/metrics` using `Authorization: Bearer $METRICS_TOKEN`. Alert on request failure rate, social-import queue depth, routing latency, and provider rate-limit counters. Application errors are emitted as structured, redacted JSON and should be forwarded by the runtime to the production error-reporting sink.
