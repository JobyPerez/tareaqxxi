(function () {
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.__APP_VERSION__ === 'string' && window.__APP_VERSION__.length > 0) {
    return;
  }

  window.__APP_BRANCH__ = '';
  window.__APP_BUILD_TIME__ = '';
  window.__APP_COMMIT_HASH__ = '';
  window.__APP_RECENT_COMMITS__ = [];
  window.__APP_SHORT_COMMIT_HASH__ = '';
  window.__APP_VERSION__ = '0.0.0';
})();
