/**
 * Bukaake Heart Sprouter Micro-Interaction
 * Spawns floating TikTok-style hearts upon clicking the author love icon (< 60 lines)
 */

const HEART_COLORS = [
  '#ef4444', '#f43f5e', '#ec4899', '#a855f7', '#8b5cf6', '#fb7185', '#e11d48',
];

export function initHeartSprouter(heartEl) {
  if (!heartEl) return;

  heartEl.setAttribute('title', 'Click for love! ❤️');
  let popTimeout = null;

  heartEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Trigger haptic scale bounce on source heart
    heartEl.classList.remove('sprout-pop');
    void heartEl.offsetWidth; // Force reflow
    heartEl.classList.add('sprout-pop');

    clearTimeout(popTimeout);
    popTimeout = setTimeout(() => {
      heartEl.classList.remove('sprout-pop');
    }, 350);

    // Calculate source center
    const rect = heartEl.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    // Spawn 1 to 2 hearts per click for juicy spam feel
    const count = Math.random() > 0.65 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      spawnFloatingHeart(x, y);
    }
  });
}

function spawnFloatingHeart(originX, originY) {
  const heart = document.createElement('i');
  heart.className = 'ri-heart-3-fill sprouted-heart';

  const tx = (Math.random() - 0.5) * 56; // -28px to +28px horizontal sway
  const rot = (Math.random() - 0.5) * 60; // -30deg to +30deg
  const dur = 0.75 + Math.random() * 0.35; // 0.75s to 1.1s
  const size = 13 + Math.floor(Math.random() * 9); // 13px to 21px
  const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];

  heart.style.left = `${originX}px`;
  heart.style.top = `${originY}px`;
  heart.style.setProperty('--tx', `${tx.toFixed(1)}px`);
  heart.style.setProperty('--rot', `${rot.toFixed(1)}deg`);
  heart.style.setProperty('--dur', `${dur.toFixed(2)}s`);
  heart.style.setProperty('--heart-size', `${size}px`);
  heart.style.setProperty('--heart-color', color);

  document.body.appendChild(heart);

  const cleanup = () => heart.remove();
  heart.addEventListener('animationend', cleanup, { once: true });
  setTimeout(cleanup, (dur + 0.1) * 1000);
}
