(function () {
  'use strict';

  var sectionNum = document.body.dataset.section
    ? parseInt(document.body.dataset.section, 10)
    : null;
  var isHome = document.body.dataset.page === 'home';

  if (!sectionNum && !isHome) return;

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
      var sections = data.sections || [];
      var rootName = window.__dcRootName();
      if (!rootName) return;

      if (isHome) {
        // No dc props needed for home — all text injected via innerHTML below
        requestAnimationFrame(function () {
          sections.forEach(function (s) {
            var el = document.getElementById('card-tagline-' + s.number);
            if (el && s.cardTagline) el.innerHTML = s.cardTagline;
          });
        });
        return;
      }

      var section = sections.find(function (s) { return s.number === sectionNum; });
      if (!section) return;

      // Pass URL/conditional fields through dc-runtime so <sc-if> and href="{{ }}" work
      window.__dcSetProps(rootName, {
        videoEmbed:       section.videoEmbed       || null,
        videoDescription: section.videoDescription || null,
        playlabEmbed:     section.playlabEmbed     || null,
        resourceLink1:    section.resourceLink1    || null,
        resourceName1:    section.resourceName1    || null,
        resourceLink2:    section.resourceLink2    || null,
        resourceName2:    section.resourceName2    || null,
      });

      // Inject rich text after React commits its re-render
      requestAnimationFrame(function () {
        var h = document.getElementById('section-headline');
        var d = document.getElementById('section-description');
        if (h && section.headline)    h.innerHTML = section.headline;
        if (d && section.description) d.innerHTML = section.description;
      });
    })
    .catch(function (err) {
      console.warn('[notion] content fetch failed:', err);
    });
}());
