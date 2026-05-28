// Web Traffic Analyzer Tracking Script
(function() {
  'use strict';

  // Configuration - Update these with your Supabase project details
  const SUPABASE_URL = 'https://your-project.supabase.co'; // Replace with your Supabase URL
  const SUPABASE_ANON_KEY = 'your-anon-key'; // Replace with your Supabase anon key

  const TRACKING_CODE = window.WTA_TRACKING_CODE || '';

  if (!TRACKING_CODE) {
    console.warn('Web Traffic Analyzer: No tracking code provided. Set window.WTA_TRACKING_CODE');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL === 'https://your-project.supabase.co') {
    console.error('Web Traffic Analyzer: Supabase configuration not set. Please update SUPABASE_URL and SUPABASE_ANON_KEY in tracking.js');
    return;
  }

  // Initialize Supabase client
  const { createClient } = window.supabase || {};
  if (!createClient) {
    console.error('Web Traffic Analyzer: Supabase client not loaded. Make sure to include the Supabase CDN script.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Get or create session ID
  function getSessionId() {
    let sessionId = localStorage.getItem('wta_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('wta_session_id', sessionId);
    }
    return sessionId;
  }

  // Get browser info
  function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';

    return browser;
  }

  // Get device type
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  // Get country from IP (simplified - in production use a proper geolocation service)
  async function getCountry() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return data.country_name || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  // Track page view
  async function trackPageView() {
    try {
      const country = await getCountry();

      const eventData = {
        page_path: window.location.pathname + window.location.search,
        referrer: document.referrer || null,
        country: country,
        device_type: getDeviceType(),
        browser: getBrowserInfo(),
        session_id: getSessionId(),
        user_id: TRACKING_CODE, // Using tracking code as user_id for simplicity
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('traffic_events')
        .insert([eventData]);

      if (error) {
        console.error('Web Traffic Analyzer tracking error:', error);
      }
    } catch (error) {
      console.error('Web Traffic Analyzer tracking error:', error);
    }
  }

  // Track on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }

  // Track on history changes (SPA navigation)
  let currentPath = window.location.pathname + window.location.search;
  const observer = new MutationObserver(() => {
    const newPath = window.location.pathname + window.location.search;
    if (newPath !== currentPath) {
      currentPath = newPath;
      trackPageView();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also listen for popstate events
  window.addEventListener('popstate', trackPageView);

  // Expose tracking function globally
  window.wtaTrack = trackPageView;
})();
