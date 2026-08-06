# Invalid migrations

## 1785900000000_stop_storing_message_bodies.sql

Never applied. Kept for the record because its *intent* — stop retaining raw
message bodies — is a real product promise that still deserves an owner.

Two reasons it could not run:

1. It is MySQL syntax. `ALTER TABLE ... MODIFY COLUMN` is not valid PostgreSQL;
   the equivalent is `ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL`.
2. It targets tables `verdicts` and `interpretations`, which belong to the
   archived Drizzle/tRPC schema. The Express app that actually ships has no
   such tables, and no code path in `db/`, `routes/`, `services/`, or `jobs/`
   references them.

If the retention promise needs enforcing against the live schema, the columns
to look at are `journal_entries.message_text` and `journal_entries.trigger_text`
— which hold user-authored journal content, not intercepted messages.
