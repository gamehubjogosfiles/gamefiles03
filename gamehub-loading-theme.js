(() => {
  const colors = ['#ef4444', '#ffd400', '#3b82f6', '#a855f7', '#f97316', '#22c55e'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  document.documentElement.style.setProperty('--gamehub-spinner-color', color);
})();
