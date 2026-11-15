/* /adset1/ Meta ads landing page.
 * Submits from the browser to the Web3Forms JSON API (same public form as the rest of the site).
 * Never sends a top-level "email" key: use "Visitor email" and "replyto" only.
 *
 * Meta Pixel ID is set and the pixel is on. It loads fbevents.js, fires PageView on load,
 * and fires Lead only after Web3Forms returns HTTP 200 with success:true (never on click).
 * CSP on this page allows https://connect.facebook.net (script-src) and
 * https://www.facebook.com plus https://connect.facebook.net (connect-src and img-src).
 * After changing PIXEL_ID, bump the ?v= hash on the script tag in index.html.
 * Conversions API is not included. This site is static GitHub Pages, and CAPI needs a
 * small server (for example a Cloudflare Worker) to send events with a secret.
 */
(function () {
  'use strict';
  var ENDPOINT = 'https://api.web3forms.com/submit';
  var PIXEL_ID = '2305271023383422';
  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  var CTRL = /[\u0000-\u001f\u007f]/;

  function initPixel() {
    if (!PIXEL_ID || PIXEL_ID === 'PIXEL_ID' || window.fbq) return;
    var f = window, b = document, e = 'script', v = 'https://connect.facebook.net/en_US/fbevents.js';
    var n = f.fbq = function () {
      if (n.callMethod) n.callMethod.apply(n, arguments);
      else n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    var t = b.createElement(e);
    t.async = true;
    t.src = v;
    var s = b.getElementsByTagName(e)[0];
    if (s && s.parentNode) s.parentNode.insertBefore(t, s);
    else b.head.appendChild(t);
    f.fbq('init', PIXEL_ID);
    f.fbq('track', 'PageView');
  }

  function trackLead() {
    if (window.fbq) window.fbq('track', 'Lead');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }

  function pageUrl() {
    var url = location.origin + location.pathname, keep = [];
    try {
      new URLSearchParams(location.search || '').forEach(function (v, k) {
        if ((/^utm_[a-z]+$/i.test(k) || k.toLowerCase() === 'fbclid') && keep.length < 8) {
          keep.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v).slice(0, 200)));
        }
      });
    } catch (_) {}
    return keep.length ? url + '?' + keep.join('&') : url;
  }

  function fillTracking(form) {
    var params;
    try { params = new URLSearchParams(location.search || ''); } catch (_) { params = null; }
    UTM_KEYS.forEach(function (k) {
      var el = form.elements[k];
      if (!el || !params) return;
      var v = params.get(k);
      if (v) el.value = String(v).slice(0, 200);
    });
    var pg = form.querySelector('[data-page]');
    if (pg) pg.value = pageUrl();
  }

  function setup(form) {
    var status = form.querySelector('[data-status]');
    var btn = form.querySelector('[data-submit]');
    fillTracking(form);

    if (/(?:^|[?&])thanks=1(?:&|$)/.test(location.search || '')) {
      form.classList.add('form-done');
      showStatus('ok', '<strong>Thanks. We will be in touch shortly.</strong>');
      if (status) status.focus();
      return;
    }

    var rules = {
      name: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 100 && !CTRL.test(v) ? '' : 'Please enter your name.'; },
      company: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 120 && !CTRL.test(v) ? '' : 'Please enter your business name.'; },
      industry: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 120 && !CTRL.test(v) ? '' : 'Please enter your business type or industry.'; },
      phone: function (v) { v = v.trim(); return PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 8 ? '' : 'Please enter a valid mobile number.'; },
      replyto: function (v) { return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address.'; },
      suburb: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 80 && !CTRL.test(v) ? '' : 'Please enter your suburb.'; },
      consent: function (v, el) { return el.checked ? '' : 'Please tick the box so we can reply to you.'; }
    };

    function setErr(name, msg) {
      var el = form.elements[name];
      var out = document.getElementById('f-' + (name === 'replyto' ? 'email' : name) + '-err');
      if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (out) out.textContent = msg || '';
    }
    function check(name) {
      var el = form.elements[name];
      var msg = rules[name](el.value || '', el);
      setErr(name, msg);
      return msg;
    }
    Object.keys(rules).forEach(function (name) {
      var el = form.elements[name];
      if (!el) return;
      el.addEventListener('blur', function () { if (el.value || el.type === 'checkbox') check(name); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
    });

    function showStatus(kind, html) {
      status.className = 'form-status ' + kind;
      status.innerHTML = html;
    }

    function payload(data, ref) {
      var body = {
        access_key: data.access_key,
        subject: 'Meta ad lead (adset1): ' + data.company.trim(),
        from_name: data.from_name || 'SkyTech Labs website',
        botcheck: false,
        Name: data.name.trim(),
        'Business name': data.company.trim(),
        'Business type': data.industry.trim(),
        'Phone number': data.phone.trim(),
        Suburb: data.suburb.trim(),
        'What they need': (data.need || '').trim() || 'Not given',
        Source: 'adset1',
        Consent: data.consent ? 'Agreed to the Privacy Policy' : 'Not given',
        'Page URL': pageUrl(),
        Reference: ref
      };
      var em = (data.replyto || '').trim();
      if (em) { body['Visitor email'] = em; body.replyto = em; }
      else body['Visitor email'] = 'Not given';
      UTM_KEYS.forEach(function (k) {
        var v = (data[k] || '').trim();
        if (v) body[k] = v;
      });
      return body;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fillTracking(form);
      var first = null;
      Object.keys(rules).forEach(function (n) { if (check(n) && !first) first = form.elements[n]; });
      if (first) { showStatus('err', '<strong>Please check the highlighted fields.</strong>'); first.focus(); return; }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v : ''; });
      data.consent = form.elements.consent.checked;
      var fail = '<strong>Sorry, that did not send.</strong><p>Your details are still here, so please try again in a moment.</p>';
      if (form.elements.botcheck && form.elements.botcheck.checked) { showStatus('err', fail); return; }
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.access_key || '') || !window.fetch) {
        form.submit();
        return;
      }
      var ref = 'STL-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(-8);
      var btnHtml = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      showStatus('', '');
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : 0;
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'strict-origin',
        signal: ctrl ? ctrl.signal : undefined,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload(data, ref))
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, body: j }; });
      }).then(function (r) {
        if (r.status !== 200 || !r.body || r.body.success !== true) throw new Error('bad status');
        form.classList.add('form-done');
        trackLead();
        showStatus('ok', '<strong>Thanks. We will be in touch shortly.</strong><p>Your reference is <strong>' + esc(ref) + '</strong>.</p>');
        status.focus();
      }).catch(function () {
        showStatus('err', fail);
      }).then(function () {
        clearTimeout(timer);
        btn.disabled = false;
        if (btn.textContent === 'Sending...') btn.innerHTML = btnHtml;
      });
    });
  }

  initPixel();
  var form = document.querySelector('[data-adset1-form]');
  if (form) setup(form);
})();
