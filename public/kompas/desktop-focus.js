/* Presentation only: no session, audio, capture, answer or persistence handlers are replaced. */
/* Focus presentation is the desktop default (owner, 23 Oct 2026): there is no Focus or Details
   button and nothing to toggle — the class is applied whenever the live view is open, and every
   control stays on the action bar, on the same level. */
/* The same focused live view on MarketFit's web Kompas (owner, 27 Oct 2026: "just like kompas desktop focus style
   everything in mfit kompas more focussed style less on styling"). */
(() => {
  const root = document.documentElement;
  const view = document.getElementById('view-copilot');
  if (!view) return;
  const apply = () => root.classList.toggle('desktop-focus', !view.classList.contains('hidden'));
  new MutationObserver(apply).observe(view, { attributes: true, attributeFilter: ['class'] });
  apply();
})();
