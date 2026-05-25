ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "emailReminder24hSent" boolean NOT NULL DEFAULT false;
