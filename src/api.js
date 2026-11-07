let sessionToken;
export async function command(name, payload = {}) {
  let result;
  if (window.practicum?.[name]) result = await window.practicum[name](payload);
  else {
    if (!sessionToken) {
      const session = await fetch('/api/session', { cache: 'no-store' });
      if (!session.ok)
        throw new Error('Локальное приложение недоступно. Запустите его и повторите попытку.');
      sessionToken = (await session.json()).token;
    }
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Practicum-Token': sessionToken },
      body: JSON.stringify({ command: name, payload }),
    });
    if (!response.ok) throw new Error('Нет связи с локальным приложением. Повторите попытку.');
    result = await response.json();
  }
  if (!result.ok) throw new Error(result.error || 'Не удалось выполнить действие.');
  return result.data;
}
