const mapping = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyJ: 'attack', KeyK: 'attack' };

export function createInput(onPause) {
  const keys = new Set();
  const pointers = new Map();
  const buttons = [...document.querySelectorAll('[data-action]')];
  function pressed(action) { return [...keys].some(code => mapping[code] === action) || [...pointers.values()].includes(action); }
  function refresh() { for (const button of buttons) button.classList.toggle('held', pressed(button.dataset.action)); }
  const clear = () => { keys.clear(); pointers.clear(); refresh(); };
  window.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.code === 'Space' && event.target instanceof HTMLButtonElement && !event.target.dataset.action) return;
    if (event.code === 'Escape' || event.code === 'KeyP') { if (!event.repeat) onPause(); return; }
    if (!mapping[event.code]) return;
    event.preventDefault(); keys.add(event.code); refresh();
  });
  window.addEventListener('keyup', event => { keys.delete(event.code); refresh(); });
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.action); refresh();
    });
    const release = event => { pointers.delete(event.pointerId); refresh(); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', event => event.preventDefault());
  }
  window.addEventListener('blur', clear);
  return { clear, read: () => Object.fromEntries(['left', 'right', 'jump', 'attack'].map(a => [a, pressed(a)])) };
}
