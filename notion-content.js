(function () {
  'use strict';

  var sectionNum = document.body.dataset.section
    ? parseInt(document.body.dataset.section, 10)
    : null;

  if (!sectionNum) return;

  // Resolves once the dc-runtime has booted and exposed its API on window
  function runtimeReady() {
    return new Promise(function (resolve) {
      (function poll() {
        if (typeof window.__dcSetProps === 'function' && typeof window.__dcRootName === 'function') {
          resolve();
        } else {
          setTimeout(poll, 40);
        }
      })();
    });
  }

  Promise.all([
    fetch('/api/content').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
    runtimeReady(),
  ])
    .then(function (results) {
      var data = results[0];
      var section = (data.sections || []).find(function (s) {
        return s.number === sectionNum;
      });
      if (!section) return;

      var rootName = window.__dcRootName();
      if (!rootName) return;

      window.__dcSetProps(rootName, {
        videoEmbed:       section.videoEmbed       || null,
        videoDescription: section.videoDescription || null,
        playlabEmbed:     section.playlabEmbed     || null,
        resourceLink1:    section.resourceLink1    || null,
        resourceName1:    section.resourceName1    || null,
        resourceLink2:    section.resourceLink2    || null,
        resourceName2:    section.resourceName2    || null,
      });
    })
    .catch(function (err) {
      console.warn('[notion] content fetch failed:', err);
    });
}());
