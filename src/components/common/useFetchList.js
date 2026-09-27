import { useEffect, useState } from 'react';

// Loads an array endpoint. A failed request (network, non-2xx, success:false,
// wrong shape) is an error with retry -- never an empty list.
export default function useFetchList(url, { token, errorText } = {}) {
  const [state, setState] = useState({ key: '', items: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  const key = `${url}#${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then(async res => {
        const body = await res.json().catch(() => null);
        const list = Array.isArray(body) ? body : body?.data;
        if (!res.ok || body?.success === false || !Array.isArray(list)) throw new Error(`HTTP ${res.status}`);
        setState({ key, items: list.filter(Boolean), error: '' });
      })
      // A superseded request's result carries an old key and is simply ignored.
      .catch(() => setState({ key, items: [], error: errorText || 'โหลดข้อมูลไม่สำเร็จ' }))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, token, key, errorText]);
  return { loading: state.key !== key, items: state.items, error: state.key === key ? state.error : '', retry: () => setAttempt(n => n + 1) };
}
