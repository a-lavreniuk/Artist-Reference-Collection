import { useEffect, useState } from 'react';

/**
 * Глобальный блокирующий оверлей на время операций обслуживания
 * (бэкап, восстановление, миграция и т. п.).
 *
 * Бэкенд выставляет/снимает `maintenanceLock` через IPC и шлёт событие
 * `arc:maintenance` (см. `src/main/maintenanceLock.ts`).
 * Renderer подписывается через `window.arc.onMaintenance(locked => …)`.
 *
 * Пока `locked === true` поверх всего приложения отображается полупрозрачный
 * оверлей с надписью «Идёт операция…». Алерты `DemoAlert` имеют более высокий
 * `z-index` и остаются видимыми — пользователь видит прогресс/успех/ошибку.
 */
export default function MaintenanceBanner() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setLocked(v));
  }, []);

  if (!locked) return null;

  return (
    <div className="arc-maintenance-banner" role="status" aria-live="polite" aria-busy="true">
      <div className="arc-maintenance-banner__panel">
        <p className="typo-p-m arc-maintenance-banner__text">Идёт операция…</p>
      </div>
    </div>
  );
}
