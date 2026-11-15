# Audio — 2026-11-15
- Доработан существующий Web Audio: оригинальная циклическая тема, шумовые удары и синтез трёх слогов голубя. Нет внешних сервисов, библиотек или платных ассетов.
- AudioContext разблокируется действием пользователя; отсутствие/блокировка звука не блокирует игру.
- Ноты планируются по currentTime аудиоконтекста с небольшим упреждением; пропущенные ноты не накапливаются после задержки кадра.
- На паузе/выходе/выключении звука все источники плавно останавливаются; onended освобождает подключения. Не более 48 голосов.
- Источники: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/start
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend
