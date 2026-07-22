import { useEffect, useState } from 'react';

/**
 * Глобальный блокирующий оверлей на время операций обслуживания
 * (бэкап, восстановление, миграция и т. п.).
 *
 * Бэкенд выставляет/снимает `maintenanceLock` через IPC и шлёт событие
 * `arc:maintenance` (см. `src/main/maintenanceLock.ts`).
 * Renderer подписывается через `window.arc.onMaintenance(locked => …)`.
 *
 * Пока `locked === true` и не `silentUi` — поверх всего приложения отображается
 * полупрозрачный оверлей с надписью «Идёт операция…». Алерты `ToastAlert` имеют
 * более высокий `z-index` и остаются видимыми — пользователь видит прогресс/успех/ошибку.
 * `silentUi` — lock без плашки (например, поиск дублей: статус в кнопке на странице).
 */
export default function MaintenanceBanner() {
  const [locked, setLocked] = useState(false);
  const [silentUi, setSilentUi] = useState(false);

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v, meta) => {
      setLocked(v);
      setSilentUi(Boolean(meta?.silentUi));
    });
  }, []);

  if (!locked || silentUi) return null;

  return (
    <div className="arc-maintenance-banner" role="status" aria-live="polite" aria-busy="true">
      <div className="arc-maintenance-banner__panel">
        <p className="text-m arc-maintenance-banner__text">Идёт операция…</p>
      </div>
    </div>
  );
}
