/* Onsite four-field callback: existing SkyTech Worker + server-only Web3Forms.
 * No native app navigation, visitor email, browser persistence or PII analytics.
 * The separate full-length SMS/WhatsApp form is deliberately unchanged. */
(function (root) {
  'use strict';
  var ENDPOINT = 'https://skytech-enquiry.nehemiah.workers.dev/callback';
  var YEARS = ['Not started yet','Less than 1 year','1–2 years','3–5 years','6–10 years','More than 10 years'];
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
  function validateData(data) {
    var errors = {};
    function val(name) { return String(data[name] == null ? '' : data[name]).trim(); }
    if (!val('name') || val('name').length > 100 || /[\u0000-\u001f\u007f]/.test(val('name'))) errors.name = 'Please enter your name (up to 100 characters).';
    if (val('phone').length > 30 || !normalizePhone(val('phone'))) errors.phone = 'Please enter a valid phone number, with a country code if outside Australia.';
    if (YEARS.indexOf(val('years')) < 0) errors.years = 'Please choose how long you have been in business.';
    if (!/^\d+$/.test(val('cleaners')) || Number(val('cleaners')) > 100000) errors.cleaners = 'Please enter a whole number of cleaners. Enter 0 if you work solo.';
    return errors;
  }
  var api = {normalizePhone:normalizePhone,validateData:validateData,ENDPOINT:ENDPOINT,YEARS:YEARS};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  var doc = root.document, dialog = doc.getElementById('cleaner-quick-dialog');
  if (!dialog || typeof dialog.showModal !== 'function' || !root.fetch || !root.crypto || !root.crypto.randomUUID || !root.AbortController) return; // Original form-anchor fallback.
  var form = doc.getElementById('cleaner-quick-form'), title = doc.getElementById('qcm-title');
  var status = doc.getElementById('qcm-status'), notice = doc.getElementById('qcm-notice');
  var trigger = null, saved = null, noticeTimer = null, hideTimer = null, successTimer = null;
  var submit = doc.getElementById('qcm-submit'), pending = false, completed = false;
  var startedAt = Date.now(), requestId = null, requestSnapshot = null;
  var fields = ['name','phone','years','cleaners'], vv = root.visualViewport;
  function clearErrors() {
    fields.forEach(function (key) { setError(key, ''); });
    status.hidden = true; status.textContent = '';
  }
  function setError(key, message) {
    form.elements[key].setAttribute('aria-invalid', message ? 'true' : 'false');
    doc.getElementById('qcm-' + key + '-err').textContent = message || '';
  }
  function gather() {
    var data = {};
    fields.forEach(function (key) { data[key] = form.elements[key].value.trim(); });
    return data;
  }
  function keepFocusedVisible() {
    var active = doc.activeElement;
    if (dialog.open && active && form.contains(active)) active.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  }
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
    root.scrollTo(position.x,position.y);
    root.requestAnimationFrame(function () { doc.documentElement.style.scrollBehavior = previous; });
  }
  function hideNotice() {
    root.clearTimeout(noticeTimer); root.clearTimeout(hideTimer);
    notice.hidden = true; notice.classList.remove('qcm-notice-visible');
  }
  function acknowledge() {
    hideNotice(); notice.textContent = 'Thanks for contacting us. We’ll get back to you shortly. Feel free to keep exploring.';
    notice.hidden = false;
    root.requestAnimationFrame(function () { notice.classList.add('qcm-notice-visible'); });
    noticeTimer = root.setTimeout(function () {
      notice.classList.remove('qcm-notice-visible');
      hideTimer = root.setTimeout(function () { notice.hidden = true; },200);
    },4500);
  }
  function open(button) {
    if (dialog.open) return;
    trigger = button; hideNotice(); if (!pending) clearErrors(); lock();
    if (Date.now() - startedAt > 86400000) startedAt = Date.now();
    try { dialog.showModal(); }
    catch (error) { unlock(); root.location.hash = 'cleaner-message-form'; return; }
    dialog.scrollTop = 0;
    viewport(); title.focus({preventScroll:true}); // No automatic mobile keyboard.
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close',function () {
    root.clearTimeout(successTimer);
    if (completed) { resetCompleted(); acknowledge(); }
    unlock();
    if (trigger && trigger.isConnected) trigger.focus({preventScroll:true});
  });
  doc.addEventListener('click',function (event) {
    var button = event.target.closest && event.target.closest('[data-quick-enquiry]');
    if (!button || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button > 0) return;
    event.preventDefault(); event.stopPropagation(); open(button);
  },true);
  doc.getElementById('qcm-close').addEventListener('click',close);
  dialog.addEventListener('cancel',function (event) { event.preventDefault(); close(); });
  dialog.addEventListener('click',function (event) {
    if (event.target !== dialog) return;
    var rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener('keydown',function (event) {
    if (event.key !== 'Tab') return;
    var items = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'))
      .filter(function (item) { return item.getAttribute('tabindex') !== '-1' && item.getClientRects().length > 0; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (doc.activeElement === first || doc.activeElement === title)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  function setPending(value) {
    pending = value; submit.disabled = value || completed;
    submit.textContent = value ? 'Sending…' : completed ? 'Request accepted' : 'Request a callback';
    form.setAttribute('aria-busy',value ? 'true' : 'false');
    fields.forEach(function (key) { form.elements[key].disabled = value || completed; });
  }
  function showStatus(message, error) {
    status.setAttribute('role',error ? 'alert' : 'status');
    status.textContent = message; status.hidden = false;
  }
  function resetCompleted() {
    completed = false; form.reset(); requestId = null; requestSnapshot = null;
    startedAt = Date.now(); setPending(false);
  }
  function failureMessage(error) {
    if (error === 'rate_limited') return 'Too many requests from this connection. Please try again in an hour.';
    if (error === 'please_retry' || error === 'processing') return 'Please wait a moment, then try again. Your details are still here.';
    if (error === 'request_changed') return 'Your request could not be confirmed. Please try again.';
    return 'Your request could not be confirmed. Please try again. Your details are still here.';
  }
  form.addEventListener('submit',async function (event) {
    event.preventDefault();
    if (pending || completed) return;
    var data = gather(), errors = validateData(data), first = null;
    fields.forEach(function (key) { setError(key,errors[key]); if (errors[key] && !first) first = form.elements[key]; });
    status.hidden = !first; status.textContent = first ? 'Please check the highlighted fields.' : '';
    if (first) { first.focus(); viewport(); return; }
    data.phone = normalizePhone(data.phone); data.cleaners = String(Number(data.cleaners));
    var snapshot = JSON.stringify(data);
    if (requestSnapshot !== snapshot) { requestId = root.crypto.randomUUID(); requestSnapshot = snapshot; }
    var serverFirst = null, controller = new root.AbortController();
    var timeout = root.setTimeout(function () { controller.abort(); },20000);
    setPending(true); showStatus('Sending your callback request…',false);
    try {
      var response = await root.fetch(ENDPOINT, {
        method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json',Accept:'application/json'},signal:controller.signal,
        body:JSON.stringify({name:data.name,phone:data.phone,years:data.years,cleaners:data.cleaners,
          website:form.elements.website.value,ts:startedAt,id:requestId,page:root.location.pathname})
      });
      var result = await response.json();
      if (!response.ok || !result || result.ok !== true || result.accepted !== true || result.emailed !== true) {
        if (result && result.fields) {
          fields.forEach(function (key) { if (result.fields[key]) { setError(key,result.fields[key]); if (!serverFirst) serverFirst = form.elements[key]; } });
        }
        if (result && result.error === 'request_changed') { requestId = null; requestSnapshot = null; }
        showStatus(failureMessage(result && result.error),true);
        return;
      }
      completed = true;
      showStatus('Thanks for contacting us. We’ll get back to you shortly.',false);
      if (dialog.open) successTimer = root.setTimeout(close,1200);
      else { resetCompleted(); acknowledge(); }
    } catch (_) {
      showStatus('Your request could not be confirmed. Please try again. Your details are still here.',true);
    } finally {
      root.clearTimeout(timeout); setPending(false); if (serverFirst && dialog.open) serverFirst.focus(); viewport();
    }
  });
  function edit(event) {
    var key = event.target.name;
    if (fields.indexOf(key) >= 0 && event.target.getAttribute('aria-invalid') === 'true') setError(key,validateData(gather())[key]);
  }
  form.addEventListener('input',edit); form.addEventListener('change',edit);
  form.addEventListener('focusin',function () { root.requestAnimationFrame(viewport); });
  root.addEventListener('resize',viewport,{passive:true});
  if (vv) { vv.addEventListener('resize',viewport,{passive:true}); vv.addEventListener('scroll',viewport,{passive:true}); }
})(typeof window !== 'undefined' ? window : globalThis);
