/* SkyTech Labs: shared "Register your interest" callback popup for every page.
 * Any element with [data-quick-enquiry] opens one compact native <dialog>; its href stays as the no-JS fallback.
 * Submits straight from the browser to the documented Web3Forms JSON API (the access key is public by design).
 * Industry pages (<html data-trade="...">) hide "Type of business" and send the industry automatically.
 * No browser storage, analytics or PII tracking. The cleaning page's full SMS/WhatsApp form is separate and unchanged. */
(function (root) {
  'use strict';
  var ENDPOINT = 'https://api.web3forms.com/submit';
  var ACCESS_KEY = '49d5b91a-6bfc-4332-9e40-f1b10483c898';
  var YEARS = ['Not started yet','Less than 1 year','1–2 years','3–5 years','6–10 years','More than 10 years'];
  var INDUSTRIES = {cleaner:'Cleaning',plumber:'Plumbing',electrician:'Electrical',hvac:'HVAC / air conditioning',dentist:'Dental practice',
    accountant:'Accounting / bookkeeping','personal-trainer':'Personal training / gym',physio:'Physio / allied health',
    'property-manager':'Property management',salon:'Hair and beauty salon'};
  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var CTRL = /[\u0000-\u001f\u007f]/;
  function normalizePhone(input) {
    var value = String(input || '').trim();
    if (!/^[+\d\s().-]+$/.test(value)) return null;
    var digits = value.replace(/\D/g, '');
    if (digits.indexOf('00') === 0) digits = digits.slice(2);
    if (digits.charAt(0) === '0' && digits.length === 10) digits = '61' + digits.slice(1);
    else if (digits.length === 9 && /^[23478]/.test(digits)) digits = '61' + digits;
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (digits.indexOf('61') === 0 && !/^61[23478]\d{8}$/.test(digits)) return null;
    return '+' + digits;
  }
  function industryFor(trade) {
    trade = String(trade || '').trim().toLowerCase();
    if (!trade) return '';
    if (INDUSTRIES[trade]) return INDUSTRIES[trade];
    var words = trade.replace(/[^a-z0-9]+/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
  }
  function validateData(data, industry) {
    var errors = {};
    function val(name) { return String(data[name] == null ? '' : data[name]).trim(); }
    if (!val('name') || val('name').length > 100 || CTRL.test(val('name'))) errors.name = 'Please enter your name (up to 100 characters).';
    if (val('phone').length > 30 || !normalizePhone(val('phone'))) errors.phone = 'Please enter a valid phone number, with a country code if outside Australia.';
    if (!industry && (!val('business') || val('business').length > 80 || CTRL.test(val('business')))) errors.business = 'Please tell us your type of business.';
    if (YEARS.indexOf(val('years')) < 0) errors.years = 'Please choose how long you have been in business.';
    if (val('email') && (val('email').length > 254 || !EMAIL_RE.test(val('email')))) errors.email = 'Please check your email address, or leave it blank.';
    return errors;
  }
  function pageUrl(loc) {
    var url = String(loc.origin || '') + String(loc.pathname || '/'), keep = [];
    try {
      new URLSearchParams(loc.search || '').forEach(function (v, k) { if (/^utm_[a-z]+$/i.test(k) && keep.length < 6) keep.push(encodeURIComponent(k) + '=' + encodeURIComponent(v.slice(0, 100))); });
    } catch (_) {}
    return keep.length ? url + '?' + keep.join('&') : url;
  }
  function buildPayload(data, industry, loc, reference) {
    var kind = industry || String(data.business).trim();
    var body = {access_key:ACCESS_KEY,from_name:'SkyTech Labs website',subject:'Register your interest: ' + kind,botcheck:false,
      Name:String(data.name).trim(),'Phone number':normalizePhone(data.phone),Industry:kind,
      'Industry source':industry ? 'Set by the page they were reading' : 'Entered by the visitor',
      'Time in business':String(data.years).trim(),
      Request:'Please call me back.','Page URL':pageUrl(loc),Reference:reference};
    if (String(data.email || '').trim()) body.email = String(data.email).trim(); // Web3Forms uses "email" as reply-to.
    else body.Email = 'Not given';
    return body;
  }
  function validAccessKey(value) { return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value || '')); }
  var api = {ENDPOINT:ENDPOINT,YEARS:YEARS,INDUSTRIES:INDUSTRIES,normalizePhone:normalizePhone,industryFor:industryFor,
    validateData:validateData,buildPayload:buildPayload,pageUrl:pageUrl,validAccessKey:validAccessKey,ACCESS_KEY:ACCESS_KEY};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  var doc = root.document;
  if (!validAccessKey(ACCESS_KEY) || !root.HTMLDialogElement || !root.fetch || !root.crypto || !root.crypto.randomUUID || !root.AbortController) return; // Links keep their #book / form fallback.
  var industry = industryFor(doc.documentElement.getAttribute('data-trade'));
  var opts = '<option value="">Select time in business</option>' + YEARS.map(function (y) { return '<option>' + y + '</option>'; }).join('');
  function field(key, label, control) {
    return '<div class="qcm-field" id="qcm-' + key + '-field"><label class="qcm-label" for="qcm-' + key + '">' + label + '</label>' + control +
      '<p id="qcm-' + key + '-err" class="qcm-error" aria-live="polite"></p></div>';
  }
  var dialog = doc.createElement('dialog');
  dialog.id = 'ri-dialog'; dialog.className = 'ri-dialog';
  dialog.setAttribute('aria-labelledby','qcm-title'); dialog.setAttribute('aria-describedby','qcm-intro'); dialog.setAttribute('data-clarity-mask','True');
  dialog.innerHTML = '<button id="qcm-close" class="qcm-close" type="button" aria-label="Close">×</button>' +
    '<h2 id="qcm-title" class="qcm-title" tabindex="-1">Register your interest</h2>' +
    '<p id="qcm-intro" class="qcm-intro">Leave your details and we’ll call you back shortly.</p>' +
    '<p id="qcm-status" class="qcm-status" role="alert" hidden></p>' +
    '<form id="ri-form" class="qcm-form" novalidate data-clarity-mask="True">' +
    '<div class="qcm-trap" aria-hidden="true"><label for="qcm-botcheck">Leave this unchecked</label><input id="qcm-botcheck" name="botcheck" type="checkbox" tabindex="-1" autocomplete="off" hidden></div>' +
    '<div class="qcm-fields">' +
    field('name','Name <span aria-hidden="true">*</span>','<input id="qcm-name" class="qcm-control" name="name" type="text" autocomplete="name" maxlength="100" required aria-describedby="qcm-name-err" data-clarity-mask="True">') +
    field('phone','Phone number <span aria-hidden="true">*</span>','<input id="qcm-phone" class="qcm-control" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" required aria-describedby="qcm-phone-err" data-clarity-mask="True">') +
    (industry ? '<input type="hidden" name="industry" value="">' :
      field('business','Type of business <span aria-hidden="true">*</span>','<input id="qcm-business" class="qcm-control" name="business" type="text" autocomplete="off" maxlength="80" required placeholder="e.g. plumbing, cleaning, café" aria-describedby="qcm-business-err" data-clarity-mask="True">')) +
    field('years','How long in business <span aria-hidden="true">*</span>','<select id="qcm-years" class="qcm-control" name="years" required aria-describedby="qcm-years-err" data-clarity-mask="True">' + opts + '</select>') +
    field('email','Email <span class="qcm-hint">(optional)</span>','<input id="qcm-email" class="qcm-control" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" aria-describedby="qcm-email-err" data-clarity-mask="True">') +
    '</div><button id="qcm-submit" class="btn qcm-submit" type="submit">Request a callback</button></form>';
  var notice = doc.createElement('p');
  notice.id = 'qcm-notice'; notice.className = 'qcm-notice'; notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite'); notice.hidden = true;
  doc.body.appendChild(dialog); doc.body.appendChild(notice);
  var form = dialog.querySelector('form'), title = dialog.querySelector('#qcm-title'), status = dialog.querySelector('#qcm-status'), submit = dialog.querySelector('#qcm-submit');
  if (industry) form.elements.industry.value = industry;
  var fields = industry ? ['name','phone','years','email'] : ['name','phone','business','years','email'];
  var trigger = null, saved = null, noticeTimer = null, hideTimer = null, successTimer = null, pending = false, completed = false;
  var requestId = null, requestSnapshot = null, vv = root.visualViewport;
  Array.prototype.forEach.call(doc.querySelectorAll('[data-quick-enquiry]'), function (a) { a.setAttribute('aria-haspopup','dialog'); a.setAttribute('aria-controls','ri-dialog'); });
  function setError(key, message) {
    form.elements[key].setAttribute('aria-invalid', message ? 'true' : 'false');
    dialog.querySelector('#qcm-' + key + '-err').textContent = message || '';
  }
  function clearErrors() { fields.forEach(function (key) { setError(key, ''); }); status.hidden = true; status.textContent = ''; }
  function gather() { var data = {}; fields.forEach(function (key) { data[key] = form.elements[key].value.trim(); }); return data; }
  function keepFocusedVisible() { var a = doc.activeElement; if (dialog.open && a && form.contains(a)) a.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'}); }
  function viewport() {
    if (!dialog.open) return;
    dialog.style.setProperty('--qcm-vv-height', (vv ? vv.height : root.innerHeight) + 'px');
    dialog.style.setProperty('--qcm-vv-top', (vv ? vv.offsetTop : 0) + 'px');
    root.requestAnimationFrame(keepFocusedVisible);
  }
  function lock() {
    saved = {x:root.scrollX || 0,y:root.scrollY || 0};
    doc.documentElement.style.setProperty('--qcm-page-top', -saved.y + 'px');
    doc.documentElement.classList.add('qcm-is-open');
  }
  function unlock() {
    doc.documentElement.classList.remove('qcm-is-open');
    doc.documentElement.style.removeProperty('--qcm-page-top');
    if (!saved) return;
    var position = saved, previous = doc.documentElement.style.scrollBehavior;
    saved = null; doc.documentElement.style.scrollBehavior = 'auto';
    root.scrollTo(position.x, position.y);
    root.requestAnimationFrame(function () { doc.documentElement.style.scrollBehavior = previous; });
  }
  function hideNotice() { root.clearTimeout(noticeTimer); root.clearTimeout(hideTimer); notice.hidden = true; notice.classList.remove('qcm-notice-visible'); }
  function acknowledge() {
    hideNotice(); notice.textContent = 'Thanks for registering your interest. We’ll call you back shortly. Feel free to keep exploring.';
    notice.hidden = false;
    root.requestAnimationFrame(function () { notice.classList.add('qcm-notice-visible'); });
    noticeTimer = root.setTimeout(function () {
      notice.classList.remove('qcm-notice-visible');
      hideTimer = root.setTimeout(function () { notice.hidden = true; }, 200);
    }, 4500);
  }
  function open(button) {
    if (dialog.open) return true;
    trigger = button; hideNotice(); if (!pending) clearErrors(); lock();
    try { dialog.showModal(); } catch (error) { unlock(); return false; }
    dialog.scrollTop = 0; viewport(); title.focus({preventScroll:true}); // No automatic mobile keyboard.
    return true;
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', function () {
    root.clearTimeout(successTimer);
    if (completed) { resetCompleted(); acknowledge(); }
    unlock();
    if (trigger && trigger.isConnected) trigger.focus({preventScroll:true});
  });
  doc.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-quick-enquiry]');
    if (!button || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button > 0) return;
    event.preventDefault(); event.stopPropagation();
    if (!open(button) && button.href) root.location.assign(button.href);
  }, true);
  dialog.querySelector('#qcm-close').addEventListener('click', close);
  dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
  dialog.addEventListener('click', function (event) {
    if (event.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });
  dialog.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab') return;
    var items = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'))
      .filter(function (item) { return item.getAttribute('tabindex') !== '-1' && item.getClientRects().length > 0; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (doc.activeElement === first || doc.activeElement === title)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  function setPending(value) {
    pending = value; submit.disabled = value || completed;
    submit.textContent = value ? 'Sending…' : completed ? 'Request received' : 'Request a callback';
    form.setAttribute('aria-busy', value ? 'true' : 'false');
    fields.forEach(function (key) { form.elements[key].disabled = value || completed; });
  }
  function showStatus(message, error) { status.setAttribute('role', error ? 'alert' : 'status'); status.textContent = message; status.hidden = false; }
  function resetCompleted() { completed = false; form.reset(); if (industry) form.elements.industry.value = industry; requestId = null; requestSnapshot = null; setPending(false); }
  function failureMessage(code) {
    if (code === 429) return 'Too many requests from this connection. Please try again in an hour.';
    return 'Your request could not be confirmed. Please try again. Your details are still here.';
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || completed) return;
    var data = gather(), errors = validateData(data, industry), first = null;
    fields.forEach(function (key) { setError(key, errors[key]); if (errors[key] && !first) first = form.elements[key]; });
    status.hidden = !first; status.textContent = first ? 'Please check the highlighted fields.' : '';
    if (first) { first.focus(); viewport(); return; }
    var snapshot = JSON.stringify(data);
    if (requestSnapshot !== snapshot) { requestId = root.crypto.randomUUID(); requestSnapshot = snapshot; }
    if (form.elements.botcheck.checked) { showStatus(failureMessage(), true); return; }
    var controller = new root.AbortController(), timeout = root.setTimeout(function () { controller.abort(); }, 20000);
    setPending(true); showStatus('Sending your details…', false);
    try {
      var response = await root.fetch(ENDPOINT, {
        method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'strict-origin',
        headers:{'Content-Type':'application/json',Accept:'application/json'},signal:controller.signal,
        body:JSON.stringify(buildPayload(data, industry, root.location, 'STL-' + requestId.replace(/-/g,'').slice(0,8).toUpperCase()))
      });
      var result = await response.json();
      if (response.status !== 200 || !result || result.success !== true) { showStatus(failureMessage(response.status), true); return; }
      completed = true;
      showStatus('Thanks for registering your interest. We’ll call you back shortly.', false);
      if (dialog.open) successTimer = root.setTimeout(close, 1200); else { resetCompleted(); acknowledge(); }
    } catch (_) {
      showStatus(failureMessage(), true);
    } finally {
      root.clearTimeout(timeout); setPending(false); viewport();
    }
  });
  function edit(event) {
    var key = event.target.name;
    if (fields.indexOf(key) >= 0 && event.target.getAttribute('aria-invalid') === 'true') setError(key, validateData(gather(), industry)[key]);
  }
  form.addEventListener('input', edit); form.addEventListener('change', edit);
  form.addEventListener('focusin', function () { root.requestAnimationFrame(viewport); });
  root.addEventListener('resize', viewport, {passive:true});
  if (vv) { vv.addEventListener('resize', viewport, {passive:true}); vv.addEventListener('scroll', viewport, {passive:true}); }
})(typeof window !== 'undefined' ? window : globalThis);
