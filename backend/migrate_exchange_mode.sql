-- Migration: Add exchange_mode column to items table
-- Run this for existing databases that were created before this column was added.

ALTER TABLE items ADD COLUMN IF NOT EXISTS exchange_mode VARCHAR(50) NOT NULL DEFAULT 'swap';

-- Verify
-- SELECT id, title, exchange_mode FROM items LIMIT 5;
