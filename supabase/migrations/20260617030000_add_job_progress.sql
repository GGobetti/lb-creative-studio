-- Add progress column to telegram_scraper_jobs
ALTER TABLE telegram_scraper_jobs
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
