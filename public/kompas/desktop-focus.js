/* Presentation only: no session, audio, capture, answer or persistence handlers are replaced. */
(() => {
  if (!window.kompasDesktop) return;
  const root = document.documentElement;
  const view = document.getElementById('view-copilot');
  const actions = document.querySelector('#overlay .bar-actions');
  if (!view || !actions || document.getElementById('desktopFocusBtn')) return;
  let focus = true;
  try { focus = localStorage.getItem('kompas.desktopFocus') !== 'off'; } catch {}
  const button = document.createElement('button');
  button.id = 'desktopFocusBtn'; button.type = 'button'; button.className = 'pill action';
  button.textContent = 'Focus'; button.title = 'Keep the response prominent and reduce surrounding controls';
  const details = document.createElement('button');
  details.id = 'desktopDetailsBtn'; details.type = 'button'; details.className = 'pill action';
  details.textContent = 'Details'; details.setAttribute('aria-expanded', 'false');
  details.title = 'Show Auto, Follow Along, audience and session details';
  actions.append(button, details);
  const apply = () => {
    root.classList.toggle('desktop-focus', focus && !view.classList.contains('hidden'));
    button.setAttribute('aria-pressed', String(focus));
    details.hidden = !focus;
  };
  button.addEventListener('click', () => {
    focus = !focus;
    root.classList.remove('desktop-details');
    details.setAttribute('aria-expanded', 'false');
    try { localStorage.setItem('kompas.desktopFocus', focus ? 'on' : 'off'); } catch {}
    apply();
  });
  details.addEventListener('click', () => {
    const open = root.classList.toggle('desktop-details');
    details.setAttribute('aria-expanded', String(open));
  });
  new MutationObserver(apply).observe(view, { attributes: true, attributeFilter: ['class'] });
  apply();
})();
