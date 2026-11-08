/* Cleaner-only draft builder. No submission endpoint, persistence or PII analytics.
 * SMS platform/body mechanism reused from:
 * Driveway Detailing assets/enquiry-utils.js (Nishant).
 * Only the destination is SkyTech's existing published business number.
 */
(function (root) {
  'use strict';
  var PHONE_LOCAL = '0450912500', PHONE_INTL = '61450912500';
  var YEARS = ['Not started yet','Less than 1 year','1–2 years','3–5 years','6–10 years','More than 10 years'];
  // Same platform precedence and URI separators as DDEnquiry: Android wins hybrid UAs.
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
  function buildWhatsAppUri(body) { return 'https://wa.me/' + PHONE_INTL + '?text=' + encodeURIComponent(body); }
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
    if (val('tools').length > 600) errors.tools = 'Please keep the tools/apps list to 600 characters or fewer.';
    if (val('email') && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email')) || val('email').length > 254)) errors.email = 'Please enter a valid email address, or leave it blank.';
    return errors;
  }
  function buildMessage(data) {
    var lines = ['Hi Nehem, I’d like to know more about AI automation for my cleaning business. Please contact me.', '',
      'Name: ' + data.name, 'Mobile: ' + (normalizePhone(data.phone) || data.phone),
      'Time in cleaning business: ' + data.years, 'Current cleaners: ' + data.cleaners + (Number(data.cleaners) === 0 ? ' (solo operator)' : '')];
    if (String(data.tools || '').trim()) lines.push('Tools / apps: ' + data.tools);
    if (data.email) lines.push('Email: ' + data.email);
    return lines.join('\n');
  }
  var api = {smsPlatform:smsPlatform,buildSmsUri:buildSmsUri,buildWhatsAppUri:buildWhatsAppUri,normalizePhone:normalizePhone,validateData:validateData,buildMessage:buildMessage,PHONE_LOCAL:PHONE_LOCAL,PHONE_INTL:PHONE_INTL};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  var doc = root.document, form = doc.getElementById('cleaner-message-form');
  if (!form) return;
  var sms = doc.getElementById('cm-sms'), wa = doc.getElementById('cm-whatsapp');
  var status = doc.getElementById('cm-status'), fallback = doc.getElementById('cm-fallback'), preview = doc.getElementById('cm-preview');
  function gather() {
    var data = {};
    ['name','phone','years','cleaners','tools','email'].forEach(function (name) { data[name] = form.elements[name].value.trim(); });
    return data;
  }
  function setError(name, text) {
    form.elements[name].setAttribute('aria-invalid', text ? 'true' : 'false');
    doc.getElementById('cm-' + name + '-err').textContent = text || '';
  }
  function openDraft(channel) {
    var data = gather(), errors = validateData(data), first = null;
    Object.keys(data).forEach(function (name) { setError(name,errors[name]); if (errors[name] && !first) first = form.elements[name]; });
    status.hidden = !first;
    status.textContent = first ? 'Please check the highlighted fields before opening your message.' : '';
    if (first) { first.focus(); return; }
    var body = buildMessage(data);
    preview.value = body; fallback.hidden = false;
    doc.getElementById('cm-copy-status').textContent = '';
    // Preparing/opening a composer is NOT receipt of a lead. The visitor must press Send.
    if (channel === 'whatsapp') root.open(buildWhatsAppUri(body), '_blank', 'noopener,noreferrer');
    else root.location.href = buildSmsUri(PHONE_LOCAL, body, root.navigator.userAgent);
    doc.getElementById('cm-draft-title').focus({preventScroll:true});
    fallback.scrollIntoView({block:'nearest',behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  sms.disabled = false; wa.disabled = false;
  sms.addEventListener('click',function () { openDraft('sms'); });
  wa.addEventListener('click',function () { openDraft('whatsapp'); });
  form.addEventListener('submit',function (event) { event.preventDefault(); openDraft('sms'); });
  form.addEventListener('input',function (event) {
    var name = event.target.name;
    if (name && form.elements[name] && event.target.getAttribute('aria-invalid') === 'true') setError(name,validateData(gather())[name]);
    fallback.hidden = true; preview.value = '';
  });
  form.addEventListener('change',function (event) {
    if (event.target.name) setError(event.target.name,validateData(gather())[event.target.name]);
    fallback.hidden = true; preview.value = '';
  });
  doc.getElementById('cm-copy').addEventListener('click',function () {
    var out = doc.getElementById('cm-copy-status');
    function selectFallback() { preview.focus(); preview.select(); out.textContent = 'Message selected. Use Copy on your device, then paste it into a message to 0450 912 500.'; }
    if (!root.navigator.clipboard || !root.navigator.clipboard.writeText) { selectFallback(); return; }
    root.navigator.clipboard.writeText(preview.value).then(function () {
      out.textContent = 'Copied. Paste it into your messaging app and press Send to 0450 912 500.';
    }).catch(selectFallback);
  });
})(typeof window !== 'undefined' ? window : globalThis);
