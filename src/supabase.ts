import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pxinlyfrpuanmhepvjih.supabase.co';
const supabaseKey = 'sb_publishable_eCLokI_oWKZ7X7Zk1y-JFw_o_t94Fly'; // Provided by user

export const supabase = createClient(supabaseUrl, supabaseKey);
