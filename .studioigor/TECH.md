ENGINE: web
ENGINE VERSION: browser Canvas 2D
DIMENSION: 2D
LANGUAGE: JavaScript ES modules
PLATFORMS: web, android browser, ios browser
Decision: Canvas 2D + DOM controls + Web Audio. Одна арена и простая кинематика не требуют физического движка.
Alternatives: Phaser добавляет сцены/физику, Godot добавляет редактор и экспорт; в текущем объёме используем платформенные API.
Budgets: 4 живых врага; ограниченные эффекты; devicePixelRatio ≤ 2; 60 fps — цель для проверки.
