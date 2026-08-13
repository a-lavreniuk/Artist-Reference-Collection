/** Issue a short-lived confirm token after the user confirms in UI. */
export async function requestDestructiveConfirm(payload: {
  kind: 'empty-trash' | 'permanent-delete-card' | 'delete-library-disk' | 'duplicate-delete-card';
  binding?: string;
  uses?: number;
}): Promise<string> {
  const arc = window.arc;
  if (!arc?.requestDestructiveConfirm) {
    throw new Error('Подтверждение удаления недоступно');
  }
  const res = await arc.requestDestructiveConfirm(payload);
  if (!res.ok || !res.token) {
    throw new Error('error' in res ? res.error : 'Не удалось получить подтверждение');
  }
  return res.token;
}
