/* Cleaner route only. No network submission, analytics, storage or automatic messaging. */
(function (root) {
  'use strict';
  // Add the owner's approved, captioned recording here. Keep empty until supplied.
  const VSL = { src: '', captions: '', poster: '' };
  const BUSINESS_PHONE = '+61450912500'; // Existing published SkyTech business number.
  function normalizePhone(input) {
    const value = String(input || '').trim();
    if (!/^[+\d\s().-]+$/.test(value)) return null;
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 10) digits = '61' + digits.slice(1);
    else if (digits.length === 9 && /^[23478]/.test(digits)) digits = '61' + digits;
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (digits.startsWith('61') && !/^61[23478]\d{8}$/.test(digits)) return null;
    return '+' + digits;
  }
  function buildMessage(values) {
    return [
      'Hi Nehem, I found SkyTech Labs and would like to explore an AI automation strategy for my business. Please contact me.', '',
      'Name: ' + values.contactName,
      'Callback: ' + values.callback,
      'Business: ' + values.company,
      'Role: ' + values.role,
      'Stage: ' + values.stage,
      'Service: ' + values.businessType,
      'Team size (including me): ' + values.team,
      'Admin / VA support: ' + values.admin,
      'Biggest headache: ' + values.pain,
      ...(values.notes ? ['', 'More context: ' + values.notes] : [])
    ].join('\n');
  }
  function messageURL(channel, text, ua) {
    if (channel === 'whatsapp') return 'https://wa.me/' + BUSINESS_PHONE.slice(1) + '?text=' + encodeURIComponent(text);
    const apple = /iPad|iPhone|iPod/.test(ua || '');
    return 'sms:' + BUSINESS_PHONE + (apple ? '&' : '?') + 'body=' + encodeURIComponent(text);
  }
  const api = { normalizePhone, buildMessage, messageURL, BUSINESS_PHONE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root.document) return;
  const doc = root.document;
  // Progressive enhancement: no player, play button or empty space until a real video exists.
  if (VSL.src && VSL.captions) {
    const mount = doc.getElementById('vsl-mount');
    const title = doc.createElement('h2'); title.textContent = 'See what this could look like in your business';
    const host = doc.createElement('div'); host.className = 'vsl-host';
    const shell = doc.createElement('div'); shell.className = 'vsl-shell';
    const video = doc.createElement('video'); video.controls = true; video.preload = 'metadata'; video.playsInline = true;
    video.src = VSL.src; video.setAttribute('aria-label', 'SkyTech Labs cleaning business AI strategy video');
    if (VSL.poster) video.poster = VSL.poster;
    const captions = doc.createElement('track'); captions.kind = 'captions'; captions.src = VSL.captions; captions.srclang = 'en'; captions.label = 'English'; captions.default = true;
    video.appendChild(captions);
    const dismiss = doc.createElement('button'); dismiss.type = 'button'; dismiss.className = 'vsl-dismiss'; dismiss.textContent = 'Close mini-player ×'; dismiss.hidden = true;
    shell.append(video, dismiss); host.appendChild(shell); mount.append(title,host); mount.hidden = false;
    let visible = true;
    function updateVideo() {
      const mini = !visible && !video.paused && !video.ended && root.matchMedia('(min-width: 761px)').matches;
      shell.classList.toggle('vsl-mini',mini); dismiss.hidden = !mini;
    }
    dismiss.addEventListener('click', () => { video.pause(); updateVideo(); });
    for (const event of ['play','pause','ended']) video.addEventListener(event,updateVideo);
    root.addEventListener('resize',updateVideo);
    if ('IntersectionObserver' in root) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updateVideo(); }, {threshold:0.15}).observe(host);
  }
  const form = doc.getElementById('strategy-form');
  if (!form) return;
  const business = doc.getElementById('business-step');
  const contact = doc.getElementById('contact-step');
  const next = doc.getElementById('next-step');
  const back = doc.getElementById('back-step');
  const progress = doc.getElementById('form-progress');
  const error = doc.getElementById('form-error');
  const fallback = doc.getElementById('message-fallback');
  let step = 1;
  next.hidden = false;
  back.hidden = false;
  contact.hidden = true;
  progress.textContent = 'Step 1 of 2 · Your business';
  function clearError(field) {
    field.classList.remove('invalid'); field.removeAttribute('aria-invalid');
    const note = doc.getElementById(field.id + '-error');
    if (note) note.remove();
    const descriptions = (field.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== field.id + '-error');
    if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
    else field.removeAttribute('aria-describedby');
  }
  function validate(container) {
    let first;
    container.querySelectorAll('input,select,textarea').forEach(field => {
      clearError(field);
      let message = '';
      if (field.required && !field.value.trim()) message = field.tagName === 'SELECT' ? 'Please choose an option.' : 'Please fill in this field.';
      else if (field.id === 'callback' && !normalizePhone(field.value)) message = 'Enter a valid callback number, including the country code if outside Australia.';
      if (!message) return;
      field.classList.add('invalid'); field.setAttribute('aria-invalid', 'true');
      const note = doc.createElement('span'); note.id = field.id + '-error'; note.className = 'field-error'; note.textContent = message;
      field.parentElement.appendChild(note);
      field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
      if (!first) first = field;
    });
    error.hidden = !first;
    error.textContent = first ? 'Please check the highlighted fields before continuing.' : '';
    if (first) { first.focus(); return false; }
    return true;
  }
  function showStep(value, focus) {
    step = value; business.hidden = value !== 1; contact.hidden = value !== 2;
    progress.textContent = value === 1 ? 'Step 1 of 2 · Your business' : 'Step 2 of 2 · Your contact details';
    if (focus) (value === 1 ? doc.getElementById('company') : doc.getElementById('contact-name')).focus();
  }
  next.addEventListener('click', () => { if (validate(business)) showStep(2, true); });
  back.addEventListener('click', () => { error.hidden = true; showStep(1, true); });
  doc.getElementById('stage').addEventListener('change', event => { doc.getElementById('stage-note').hidden = event.target.value !== 'Not trading yet'; });
  form.addEventListener('input', event => { if (event.target.matches('input,select,textarea')) clearError(event.target); });
  form.addEventListener('change', event => { if (event.target.matches('input,select,textarea')) clearError(event.target); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (step === 1) { if (validate(business)) showStep(2, true); return; }
    if (!validate(business)) { showStep(1, false); business.querySelector('.invalid').focus(); return; }
    if (!validate(contact)) return;
    const values = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(values)) values[key] = values[key].trim();
    values.callback = normalizePhone(values.callback);
    const message = buildMessage(values);
    doc.getElementById('message-preview').value = message;
    fallback.hidden = false;
    doc.getElementById('copy-status').textContent = '';
    const channel = event.submitter && event.submitter.value === 'sms' ? 'sms' : 'whatsapp';
    const url = messageURL(channel, message, navigator.userAgent);
    // This only opens a draft. Never mark an enquiry as received or send a conversion event here.
    if (channel === 'whatsapp') root.open(url, '_blank', 'noopener,noreferrer');
    else root.location.href = url;
    doc.getElementById('draft-title').focus({preventScroll:true});
    fallback.scrollIntoView({block:'nearest',behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });
  doc.getElementById('copy-message').addEventListener('click', async () => {
    const preview = doc.getElementById('message-preview');
    const status = doc.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(preview.value);
      status.textContent = 'Copied. Paste it into a message to 0450 912 500, then press Send.';
    } catch (_) {
      preview.focus(); preview.select();
      status.textContent = 'Message selected. Use your device’s Copy command, then paste it into WhatsApp or SMS.';
    }
  });
  // Keep the mobile button out of the way while entering details or reading a message draft.
  const sticky = doc.querySelector('.mobile-cta');
  if ('IntersectionObserver' in root) {
    new IntersectionObserver(entries => { sticky.classList.toggle('is-hidden', entries[0].isIntersecting); }, {threshold:0}).observe(doc.getElementById('strategy'));
  }
  doc.addEventListener('focusin', event => { if (form.contains(event.target)) sticky.classList.add('is-hidden'); });
})(typeof window !== 'undefined' ? window : globalThis);
