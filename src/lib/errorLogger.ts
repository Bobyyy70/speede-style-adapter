import { supabase } from '@/integrations/supabase/client';

interface ErrorLogData {
  message: string;
  stack: string;
  route: string;
}

let lastLogTime = 0;
const LOG_THROTTLE_MS = 5000; // Max 1 log every 5 seconds

export async function logError(error: ErrorLogData) {
  // Throttle logging to avoid spam
  const now = Date.now();
  if (now - lastLogTime < LOG_THROTTLE_MS) {
    console.warn('Error logging throttled');
    return;
  }
  lastLogTime = now;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      route: error.route,
      message: error.message,
      stack: error.stack,
      user_agent: navigator.userAgent,
    });
  } catch (err) {
    // Silently fail if logging fails to avoid infinite loops
    console.error('Failed to log error to backend:', err);
  }
}

// Setup global error handlers
export function setupGlobalErrorHandlers() {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    
    logError({
      message: event.error?.message || event.message || 'Unknown error',
      stack: event.error?.stack || '',
      route: window.location.pathname,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    logError({
      message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
      stack: event.reason?.stack || '',
      route: window.location.pathname,
    });
  });
}
