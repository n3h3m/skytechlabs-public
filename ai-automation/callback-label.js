/* Page-local: keep the AI Automation callback button label consistent with the page copy.
   Shared site.js sets "Request a call-back"; this swaps only that label, here, after it runs. */
(function () {
  var btn = document.querySelector('#enquiry-form [data-submit]');
  if (!btn || !window.MutationObserver) return;
  var OLD = 'Request a call-back', NEW = 'Have Us Call You';
  function fix() {
    if (btn.textContent.indexOf(OLD) !== -1) btn.innerHTML = NEW + ' <span aria-hidden="true">→</span>';
  }
  fix();
  new MutationObserver(fix).observe(btn, { childList: true, characterData: true, subtree: true });
})();
