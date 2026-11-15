export const WORLD = { width: 1280, height: 720, ground: 530 };
export const TUNING = {
  speed: 320, jump: 700, gravity: 1850,
  peckCooldown: 0.32, peckReach: 146, invulnerability: 1.25,
  maxEnemies: 4, spawnInterval: 1.55, rest: 3,
};
export const ENEMIES = {
  normal: { hp: 2, speed: 75, scale: 1, windup: 0.65, charge: 280, recovery: 1.05, label: 'Голубь' },
  quick: { hp: 1, speed: 130, scale: 0.82, windup: 0.55, charge: 500, recovery: 1.2, label: 'Шустрый' },
  heavy: { hp: 4, speed: 51, scale: 1.18, windup: 0.85, charge: 240, recovery: 1.35, label: 'Пузатый' },
  boss: { hp: 12, speed: 58, scale: 1.5, windup: 1, charge: 530, recovery: 1.7, label: 'Голубиный Барон' },
};
