/* SkyTech Labs: progressive enhancement. The site works without JavaScript. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    bookScroll();
    var form = document.querySelector('[data-enquiry]');
    if (form) enquiry(form);
    var list = document.querySelector('[data-checklist]');
    if (list) checklist(list);
  });


  /* Booking buttons ("#book", "#book-calendar", "/contact/#book" ...) land on the calendar itself
     ("Pick a day and time" + the card), just under the sticky header. Uses scrollIntoView + CSS
     scroll-margin-top (header height via --hdr) so mobile dynamic toolbars can't misplace it, then
     re-checks after smooth scroll, fonts, page load and the widget render (unless the user scrolls). */
  function bookScroll() {
    var root = document.documentElement, hdr = document.querySelector('.site-header');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timers = [], until = 0;
    function target() { return document.getElementById('book-calendar') || document.getElementById('book'); }
    function hh() { return hdr ? hdr.offsetHeight : 0; }
    function setHdr() { root.style.setProperty('--hdr', hh() + 'px'); }
    function snap() {
      var t = target();
      if (!t || Date.now() > until) return;
      setHdr();
      var off = t.getBoundingClientRect().top - (hh() + 12);
      if (Math.abs(off) > 3) { root.style.scrollBehavior = 'auto'; window.scrollBy(0, off); root.style.scrollBehavior = ''; }
    }
    function stop() { until = 0; timers.forEach(clearTimeout); timers = []; }
    function go(smooth) {
      var t = target();
      if (!t) return false;
      stop(); setHdr();
      until = Date.now() + 5000;
      if (!smooth || reduce) root.style.scrollBehavior = 'auto';
      t.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' });
      root.style.scrollBehavior = '';
      [250, 700, 1200, 2000, 3500].forEach(function (ms) { timers.push(setTimeout(snap, ms)); });
      timers.push(setTimeout(function () { t.focus({ preventScroll: true }); }, smooth ? 600 : 0));
      return true;
    }
    function isBook(a) {
      if (!a || !/^#book(-calendar)?$/.test(a.hash) || a.target === '_blank') return false;
      return a.origin === location.origin && a.pathname === location.pathname;
    }
    setHdr();
    window.addEventListener('resize', setHdr, { passive: true });
    ['wheel', 'touchmove', 'keydown'].forEach(function (ev) { window.addEventListener(ev, stop, { passive: true }); });
    window.addEventListener('scrollend', snap);
    document.addEventListener('bk:rendered', snap);
    window.addEventListener('load', snap);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(snap);
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#book"]');
      if (!isBook(a) || !target()) return;
      e.preventDefault();
      history.replaceState(null, '', a.hash);
      go(true);
    });
    if (/^#book(-calendar)?$/.test(location.hash)) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      go(false);
    }
  }

  function track(n, p) { if (window.skyTrack) window.skyTrack(n, p); }
  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;

  function enquiry(form) {
    var status = form.querySelector('[data-status]');
    var btn = form.querySelector('[data-submit]');
    var details = form.querySelector('[data-details]');
    var pg = form.querySelector('[data-page]'); if (pg) pg.value = location.origin + location.pathname;

    /* Topic chips: toggled buttons, sent as "details" */
    var chips = Array.prototype.slice.call(form.querySelectorAll('[data-chip]'));
    function syncChips() {
      var on = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute('data-chip'); });
      var box = form.querySelector('[data-chips]'), pre = (box && box.getAttribute('data-prefix')) || 'Time-eaters';
      details.value = on.length ? pre + ': ' + on.join(', ') : '';
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); syncChips(); });
    });

    /* Button label follows the chosen intent */
    function label() {
      var email = form.querySelector('input[name="intent"][value="email"]').checked;
      btn.innerHTML = (email ? 'Send my question' : 'Request a call-back') + ' <span aria-hidden="true">→</span>';
    }
    form.querySelectorAll('input[name="intent"]').forEach(function (r) { r.addEventListener('change', label); });
    var params = new URLSearchParams(location.search);
    var intent = params.get('intent');
    if (intent === 'call' || intent === 'email') {
      var r = form.querySelector('input[name="intent"][value="' + intent + '"]');
      if (r) r.checked = true;
    }
    label();
    if (params.get('error') === 'validation') showStatus('err', '<strong>Some details were missing.</strong><p>Please check the form and try again.</p>');

    var rules = {
      automate: function (v) { return v.trim().length >= 10 ? '' : 'Tell us a little about it (at least 10 characters).'; },
      name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your name.'; },
      company: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your business name.'; },
      phone: function (v) { v = v.trim(); return PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 8 ? '' : 'Please enter a valid phone number.'; },
      email: function (v) { return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address.'; },
      consent: function (v, el) { return el.checked ? '' : 'Please tick the box so we can reply to you.'; }
    };
    function setErr(name, msg) {
      var el = form.elements[name], out = document.getElementById('f-' + name + '-err');
      if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (out) out.textContent = msg || '';
    }
    function check(name) { var el = form.elements[name]; var msg = rules[name](el.value || '', el); setErr(name, msg); return msg; }
    Object.keys(rules).forEach(function (name) {
      var el = form.elements[name];
      el.addEventListener('blur', function () { if (el.value || el.type === 'checkbox') check(name); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
    });
    function showStatus(kind, html) { status.className = 'form-status ' + kind; status.innerHTML = html; }

    function pageUrl() {
      var url = location.origin + location.pathname, keep = [];
      try { new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_[a-z]+$/i.test(k) && keep.length < 6) keep.push(encodeURIComponent(k) + '=' + encodeURIComponent(v.slice(0, 100))); }); } catch (_) {}
      return keep.length ? url + '?' + keep.join('&') : url;
    }
    /* Sends straight from the browser to the Web3Forms JSON API (same public form key as the popup; it lives in the
       form's hidden access_key field, which is also the no-JS fallback). Delivers to the business inbox. */
    function payload(data, ref) {
      var email = data.intent === 'email';
      var body = {
        access_key: data.access_key, subject: data.subject || 'Website enquiry', from_name: data.from_name || 'SkyTech Labs website', botcheck: false,
        Name: data.name.trim(), 'Business name': data.company.trim(), 'Phone number': data.phone.trim(),
        'How they want to start': email ? 'Just ask a question (reply by email)' : 'Call me back',
        'What they want help with': data.automate.trim(),
        'Topics ticked': data.details || 'None ticked',
        Consent: data.consent ? 'Agreed to the Privacy Policy' : 'Not given',
        'Page URL': pageUrl(), Reference: ref
      };
      if (data.email.trim()) body.email = data.email.trim(); /* Web3Forms uses "email" as the reply-to address. */
      return body;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      Object.keys(rules).forEach(function (n) { if (check(n) && !first) first = form.elements[n]; });
      if (first) { showStatus('err', '<strong>Please check the highlighted fields.</strong>'); first.focus(); return; }
      syncChips();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v : ''; });
      data.consent = form.elements.consent.checked;
      var fail = '<strong>Sorry, that didn\'t send.</strong><p>Your details are still here, so please try again, or call <a href="' + form.getAttribute('data-tel') + '">' + form.getAttribute('data-phone') + '</a>.</p>';
      if (form.elements.botcheck && form.elements.botcheck.checked) { showStatus('err', fail); return; }
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.access_key || '') || !window.fetch) { form.submit(); return; }
      var ref = 'STL-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(-8);
      var btnHtml = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Sending…';
      showStatus('', '');
      var ctrl = window.AbortController ? new AbortController() : null, timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : 0;
      fetch('https://api.web3forms.com/submit', {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin', signal: ctrl ? ctrl.signal : undefined,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload(data, ref))
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, body: j }; });
      }).then(function (r) {
        if (r.status !== 200 || !r.body || r.body.success !== true) throw new Error('bad status');
        form.classList.add('form-done');
        track('form_submit', { form_id: 'enquiry', intent: data.intent || '' });
        showStatus('ok', '<strong>Thanks, ' + esc(data.name.trim().split(' ')[0]) + '. Got it.</strong>' +
          '<p>' + (data.intent === 'email' ? 'We will reply by email shortly.' : 'We will call you back shortly.') +
          ' Your reference is <strong>' + esc(ref) + '</strong>.</p>');
        status.focus();
      }).catch(function () {
        showStatus('err', fail);
      }).then(function () { clearTimeout(timer); btn.disabled = false; if (btn.textContent === 'Sending…') btn.innerHTML = btnHtml; });
    });
  }
  /* Trade-page self-check: counts ticks locally, nothing is sent anywhere */
  function checklist(f) {
    var boxes = Array.prototype.slice.call(f.querySelectorAll('[data-check]'));
    var out = document.querySelector('[data-score]');
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    function update() {
      var n = boxes.filter(function (b) { return b.checked; }).length, gaps = boxes.length - n;
      out.hidden = false;
      out.innerHTML = '<strong>' + n + ' of ' + boxes.length + ' handled.</strong> ' + (gaps === 0
        ? 'Nicely done. A quick call can still check nothing is slipping through.'
        : gaps + (gaps === 1 ? ' gap' : ' gaps') + ' worth a look. Those are exactly what the free admin check is for.');
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();

// Mobile sticky bar: appears after one swipe (30% of the screen height scrolled),
// tucked away while the booking section or the final CTA is on screen so it never overlaps them.
(function(){var bar=document.querySelector('.mobile-bar');if(!bar)return;
var hide=[document.getElementById('book'),document.querySelector('.final')].filter(Boolean);
var ticking=false,shown=false;
function onScreen(el){var r=el.getBoundingClientRect();return r.bottom>0&&r.top<window.innerHeight;}
function update(){ticking=false;
  var want=window.scrollY>=window.innerHeight*0.3&&!hide.some(onScreen);
  if(want!==shown){shown=want;bar.classList.toggle('is-shown',want);}}
function req(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
window.addEventListener('scroll',req,{passive:true});window.addEventListener('resize',req,{passive:true});req();})();

// Analytics: GA4 + Microsoft Clarity. Only on the live site (the build adds data-ga / data-clarity to <html>),
// never with Do Not Track / Global Privacy Control, and only after the page is idle or on first interaction.
(function(){var w=window,d=document,h=d.documentElement,n=navigator;
var ga=h.getAttribute('data-ga'),cl=h.getAttribute('data-clarity');
var ptype=h.getAttribute('data-ptype')||'page',region=h.getAttribute('data-region')||'',trade=h.getAttribute('data-trade')||'';
var optout=n.doNotTrack==='1'||w.doNotTrack==='1'||n.msDoNotTrack==='1'||n.globalPrivacyControl===true;
var on=!!(ga||cl)&&!optout;
w.skyTrack=function(name,p){if(!on)return;p=p||{};
  if(ga)w.gtag('event',name,p);
  if(cl){w.clarity('event',name);}};
if(!on)return;
if(ga){w.dataLayer=w.dataLayer||[];w.gtag=function(){w.dataLayer.push(arguments);};
  w.gtag('js',new Date());w.gtag('config',ga,{page_type:ptype,region:region||undefined,trade:trade||undefined});}
if(cl){w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments);};
  w.clarity('set','page_type',ptype);if(region)w.clarity('set','region',region);if(trade)w.clarity('set','trade',trade);}
var loaded=false,EV=['scroll','pointerdown','keydown','touchstart','mousemove'];
function add(src){var s=d.createElement('script');s.async=true;s.src=src;d.head.appendChild(s);}
function load(){if(loaded)return;loaded=true;EV.forEach(function(e){w.removeEventListener(e,load,{passive:true});});
  if(ga)add('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ga));
  if(cl)add('https://www.clarity.ms/tag/'+encodeURIComponent(cl));}
EV.forEach(function(e){w.addEventListener(e,load,{passive:true,once:true});});
function idle(){setTimeout(function(){(w.requestIdleCallback||function(f){setTimeout(f,1);})(load,{timeout:3000});},4000);}
if(d.readyState==='complete')idle();else w.addEventListener('load',idle);
// key events
d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;
  var href=a.getAttribute('href')||'',txt=(a.textContent||'').replace(/\s+/g,' ').trim().slice(0,80);
  var p={link_text:txt,link_url:href,page_type:ptype};
  if(href.indexOf('tel:')===0)w.skyTrack('phone_click',p);
  else if(href.indexOf('mailto:')===0)w.skyTrack('email_click',p);
  else if(/cal\.com\//.test(href)||href==='#book'||/\/#book$/.test(href)||/^(Book a free call|Pick a time)/i.test(txt))w.skyTrack('book_call_click',p);},true);
var f=d.querySelector('[data-enquiry]');
if(f){var started=false;var st=function(){if(started)return;started=true;w.skyTrack('form_start',{form_id:'enquiry',page_type:ptype});};
  f.addEventListener('focusin',st);f.addEventListener('input',st);}
})();
