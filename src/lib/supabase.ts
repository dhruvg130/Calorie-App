import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { env } from './env';
import { secureStorage } from './secureStorage';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    // Keep the user signed in across app launches, refreshing the access token
    // in the background before it expires.
    autoRefreshToken: true,
    persistSession: true,
    // There is no URL bar in a native app to parse a session out of; leaving
    // this on would make Supabase inspect `window.location` needlessly.
    detectSessionInUrl: false,
  },
});

/**
 * Supabase's refresh timer keeps firing while the app is backgrounded, which
 * burns battery and can queue failed requests with no network. Suspend it when
 * the app is not in the foreground — this is the pattern Supabase documents for
 * React Native.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
