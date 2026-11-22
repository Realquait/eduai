const { createClient } = require('@supabase/supabase-js');

function isSupabaseConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

function createSupabaseClient(accessToken) {
    if (!isSupabaseConfigured()) {
        const error = new Error('Настройте SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY в корневом файле .env.');
        error.status = 503;
        throw error;
    }

    const options = {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    };

    if (accessToken) {
        options.global = {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        };
    }

    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, options);
}

module.exports = { createSupabaseClient, isSupabaseConfigured };
