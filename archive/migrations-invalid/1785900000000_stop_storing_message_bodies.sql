-- Stop storing raw message bodies.
--
-- Rationale: the product promises that message content is not retained. The
-- application no longer writes these columns (see server/routers.ts). This
-- migration makes them nullable and purges any bodies collected before the
-- application change shipped.
--
-- The three UPDATE statements are irreversible. Take a database backup first.

ALTER TABLE verdicts        MODIFY COLUMN message         TEXT NULL;
ALTER TABLE interpretations MODIFY COLUMN receivedMessage TEXT NULL;

UPDATE verdicts        SET message         = NULL WHERE message         IS NOT NULL;
UPDATE interpretations SET receivedMessage = NULL WHERE receivedMessage IS NOT NULL;

-- safety_flags.excerpt was designed to retain quoted user text in a
-- human-reviewable triage queue. Nothing ever wrote to it, and it is now
-- removed from the schema rather than left as a latent collection point.
UPDATE safety_flags SET excerpt = NULL WHERE excerpt IS NOT NULL;
ALTER TABLE safety_flags DROP COLUMN excerpt;
