require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('telegram_scraper_jobs')
    .select('id, file_name, status, updated_at')
    .in('status', ['downloading_file', 'uploading_vault', 'indexing', 'pending']);
  console.log(data);
}
run();
