ALTER TABLE public.telegram_indexed_stls 
ADD COLUMN parent_id uuid REFERENCES public.telegram_indexed_stls(id) ON DELETE SET NULL,
ADD COLUMN parts_count integer DEFAULT 0;

ALTER TABLE public.telegram_scraper_settings 
ADD COLUMN last_heartbeat timestamptz;
