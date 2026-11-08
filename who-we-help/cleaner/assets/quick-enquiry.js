/* Compact cleaner callback enquiry. Same verified Driveway Detailing SMS platform/body
 * convention as message-form.js. The full form script is deliberately unchanged.
 * Opening a draft does not send a message. No endpoint, persistence or PII analytics.
 */
(function (root) {
  'use strict';
  var PHONE_LOCAL = '0450912500';
  var YEARS = ['Not started yet','Less than 1 year','1–2 years','3–5 years','6–10 years','More than 10 years'];
  function smsPlatform(ua) {
    var s = typeof ua === 'string' ? ua : '';
    if (/Android/i.test(s)) return 'android';
    if (/iPhone|iPad|iPod/i.test(s)) return 'ios';
    return 'other';
  }
  function buildSmsUri(phone, body, ua) {
    var num = String(phone == null ? '' : phone).replace(/\s+/g, '');
    var text = body == null ? '' : String(body);
    if (!text) return 'sms:' + num;
    var sep = smsPlatform(ua) === 'ios' ? '?&body=' : '?body=';
    return 'sms:' + num + sep + encodeURIComponent(text);
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
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
    if (!val('name') || val('name').length > 100) errors.name = 'Please enter your name (up to 100 characters).';
    if (!normalizePhone(val('phone'))) errors.phone = 'Please enter a valid phone number, with a country code if outside Australia.';
    if (YEARS.indexOf(val('years')) < 0) errors.years = 'Please choose how long you have been in business.';
    if (!/^\d+$/.test(val('cleaners')) || Number(val('cleaners')) > 100000) errors.cleaners = 'Please enter a whole number of cleaners. Enter 0 if you work solo.';
    return errors;
  }
  function buildMessage(data) {
    var lines = ['Hi Nehem, I’d like to know more about AI automation for my cleaning business. Please contact me.', '',
      'Name: ' + data.name, 'Mobile: ' + (normalizePhone(data.phone) || data.phone),
      'Time in cleaning business: ' + data.years, 'Current cleaners: ' + data.cleaners + (Number(data.cleaners) === 0 ? ' (solo operator)' : '')];
    lines.push('', 'Thanks', firstName(data.name));
    return lines.join('\n');
  }
  var api = {smsPlatform:smsPlatform,buildSmsUri:buildSmsUri,normalizePhone:normalizePhone,
    firstName:firstName,validateData:validateData,buildMessage:buildMessage,PHONE_LOCAL:PHONE_LOCAL,YEARS:YEARS};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  var doc = root.document, dialog = doc.getElementById('cleaner-quick-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return; // Original form-anchor fallback.
  var form = doc.getElementById('cleaner-quick-form'), title = doc.getElementById('qcm-title');
  var status = doc.getElementById('qcm-status'), notice = doc.getElementById('qcm-notice');
  var trigger = null, saved = null, noticeTimer = null, hideTimer = null;
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
    hideNotice(); notice.textContent = 'Finish sending in Messages. Feel free to keep exploring.';
    notice.hidden = false;
    root.requestAnimationFrame(function () { notice.classList.add('qcm-notice-visible'); });
    noticeTimer = root.setTimeout(function () {
      notice.classList.remove('qcm-notice-visible');
      hideTimer = root.setTimeout(function () { notice.hidden = true; },200);
    },4500);
  }
  function open(button) {
    if (dialog.open) return;
    trigger = button; hideNotice(); clearErrors(); lock();
    try { dialog.showModal(); }
    catch (error) { unlock(); root.location.hash = 'cleaner-message-form'; return; }
    dialog.scrollTop = 0;
    viewport(); title.focus({preventScroll:true}); // No automatic mobile keyboard.
  }
  function close() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('close',function () {
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
      .filter(function (item) { return item.getClientRects().length > 0; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (doc.activeElement === first || doc.activeElement === title)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  form.addEventListener('submit',function (event) {
    event.preventDefault();
    var data = gather(), errors = validateData(data), first = null;
    fields.forEach(function (key) { setError(key,errors[key]); if (errors[key] && !first) first = form.elements[key]; });
    status.hidden = !first; status.textContent = first ? 'Please check the highlighted fields.' : '';
    if (first) { first.focus(); viewport(); return; }
    var uri = buildSmsUri(PHONE_LOCAL,buildMessage(data),root.navigator.userAgent);
    // Synchronous visitor gesture: request the native composer before any timer/await.
    try { root.location.href = uri; }
    catch (error) { status.hidden = false; status.textContent = 'Messages could not open. Please use the message form on this page.'; return; }
    close(); acknowledge(); // Never a sent/received confirmation.
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
