import { useCallback, useEffect, useRef, useState } from 'react';

export const DOWNLOAD_WINDOW_MS = 12000;
export const UPLOAD_WINDOW_MS = 12000;
const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
const LATENCY_SAMPLES = 10;
const LATENCY_REQUEST_TIMEOUT_MS = 10000;
const TOTAL_LIMIT_MS = 90000;

export const PHASE_LABEL = {
  idle: 'พร้อมทดสอบ',
  latency: 'กำลังวัดเวลาตอบกลับ',
  download: 'กำลังทดสอบ Download',
  upload: 'กำลังทดสอบ Upload',
  completed: 'ทดสอบเสร็จสิ้น',
  cancelled: 'ยกเลิกการทดสอบ (ผลบางส่วน)',
  failed: 'ทดสอบไม่สำเร็จ (ผลบางส่วน)'
};

const INITIAL = { phase: 'idle', running: false, progress: 0, latency: null, download: null, upload: null, error: '', finishedAt: null };

const mbps = (bytes, ms) => (bytes * 8) / ((ms / 1000) * 1000000);

// Every fetch/XHR/timer of a run hangs off one `run` object so Stop, leaving
// the page and the overall time limit can all cancel it, and a superseded run
// can never write into newer state (see isCurrent).
export function useSpeedTest({ apiUrl, onComplete }) {
  const [state, setState] = useState(INITIAL);
  const runRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  const cancelRun = useCallback((reason) => {
    const run = runRef.current;
    if (!run) return;
    run.stop = reason;
    run.controller.abort();
    run.xhr?.abort();
  }, []);

  useEffect(() => () => {
    const run = runRef.current;
    runRef.current = null;
    if (run) { run.stop = 'unmount'; run.controller.abort(); run.xhr?.abort(); }
  }, []);

  const start = useCallback(async () => {
    if (runRef.current) return;
    const run = { controller: new AbortController(), xhr: null, stop: null };
    runRef.current = run;
    const isCurrent = () => runRef.current === run;
    const update = (patch) => { if (isCurrent()) setState(s => ({ ...s, ...patch })); };
    const stopped = () => { if (run.stop) throw new Error('stopped'); };
    const totalTimer = setTimeout(() => cancelRun('timeout'), TOTAL_LIMIT_MS);
    setState({ ...INITIAL, phase: 'latency', running: true });

    try {
      // 1. Latency: HTTP round trip to the upload endpoint (not ICMP ping).
      const samples = [];
      for (let i = 0; i < LATENCY_SAMPLES; i += 1) {
        stopped();
        const requestController = new AbortController();
        const timer = setTimeout(() => requestController.abort(), LATENCY_REQUEST_TIMEOUT_MS);
        const started = performance.now();
        try {
          const res = await fetch(`${apiUrl}/api/test/upload?_t=${Date.now()}`, {
            method: 'POST', body: '', cache: 'no-store', signal: AbortSignal.any([run.controller.signal, requestController.signal])
          });
          if (!res.ok) throw new Error(`เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}`);
        } catch (err) {
          if (err.name === 'AbortError' && !run.stop) throw new Error('หมดเวลารอการตอบกลับจากเซิร์ฟเวอร์');
          throw err;
        } finally {
          clearTimeout(timer);
        }
        samples.push(performance.now() - started);
        update({ progress: Math.round(((i + 1) / LATENCY_SAMPLES) * 25) });
      }
      const latency = samples.reduce((a, b) => a + b, 0) / samples.length;
      update({ latency, progress: 25, phase: 'download' });

      // 2. Download: fixed window, re-fetching back-to-back so fast links keep
      // measuring; the request still in flight when the window closes is
      // aborted and only the bytes that arrived count.
      const dlStart = performance.now();
      let received = 0;
      while (performance.now() - dlStart < DOWNLOAD_WINDOW_MS) {
        stopped();
        const windowController = new AbortController();
        const windowTimer = setTimeout(() => windowController.abort(), DOWNLOAD_WINDOW_MS - (performance.now() - dlStart));
        try {
          const res = await fetch(`${apiUrl}/api/test/download?_cb=${Math.random()}`, {
            cache: 'no-store', signal: AbortSignal.any([run.controller.signal, windowController.signal])
          });
          if (!res.ok || !res.body) throw new Error(`ดาวน์โหลดไม่สำเร็จ (HTTP ${res.status})`);
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;
            const elapsed = performance.now() - dlStart;
            update({ download: mbps(received, elapsed), progress: Math.min(59, 25 + Math.floor((elapsed / DOWNLOAD_WINDOW_MS) * 34)) });
          }
        } catch (err) {
          if (!(err.name === 'AbortError' && !run.stop && windowController.signal.aborted)) throw err;
        } finally {
          clearTimeout(windowTimer);
        }
      }
      if (received === 0) throw new Error('ไม่ได้รับข้อมูลดาวน์โหลดจากเซิร์ฟเวอร์');
      const download = mbps(received, performance.now() - dlStart);
      update({ download, progress: 60, phase: 'upload' });

      // 3. Upload: browser-side view of bytes handed to the network, not a
      // server-confirmed figure.
      const chunk = new Uint8Array(UPLOAD_CHUNK_BYTES);
      for (let i = 0; i < chunk.length; i += 65536) {
        crypto.getRandomValues(chunk.subarray(i, i + Math.min(65536, chunk.length - i)));
      }
      const ulStart = performance.now();
      let uploaded = 0;
      while (performance.now() - ulStart < UPLOAD_WINDOW_MS) {
        stopped();
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          run.xhr = xhr;
          let loaded = 0;
          const windowTimer = setTimeout(() => xhr.abort(), UPLOAD_WINDOW_MS - (performance.now() - ulStart));
          xhr.open('POST', `${apiUrl}/api/test/upload`);
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable || event.loaded <= 0) return;
            loaded = event.loaded;
            const elapsed = performance.now() - ulStart;
            update({ upload: mbps(uploaded + loaded, elapsed), progress: 60 + Math.min(39, Math.floor((elapsed / UPLOAD_WINDOW_MS) * 40)) });
          };
          xhr.onload = () => {
            clearTimeout(windowTimer);
            if (xhr.status >= 200 && xhr.status < 300) { uploaded += loaded; resolve(); }
            else reject(new Error(`อัปโหลดไม่สำเร็จ (HTTP ${xhr.status})`));
          };
          xhr.onabort = () => {
            clearTimeout(windowTimer);
            if (run.stop) reject(new Error('stopped'));
            else { uploaded += loaded; resolve(); }
          };
          xhr.onerror = () => { clearTimeout(windowTimer); reject(new Error('การอัปโหลดขัดข้อง ตรวจสอบการเชื่อมต่อ')); };
          xhr.send(chunk);
        });
      }
      if (uploaded === 0) throw new Error('ไม่สามารถอัปโหลดข้อมูลไปยังเซิร์ฟเวอร์ได้');
      const upload = mbps(uploaded, performance.now() - ulStart);

      const finishedAt = new Date();
      update({ upload, progress: 100, phase: 'completed', finishedAt });
      if (isCurrent()) onCompleteRef.current?.({ download, upload, latency, finishedAt });
    } catch (err) {
      if (!isCurrent()) return;
      if (run.stop === 'user') update({ phase: 'cancelled', error: '' });
      else if (run.stop === 'timeout') update({ phase: 'failed', error: 'การทดสอบใช้เวลานานเกินกำหนด' });
      else update({ phase: 'failed', error: err.message || 'ทดสอบไม่สำเร็จ' });
    } finally {
      clearTimeout(totalTimer);
      if (isCurrent()) {
        runRef.current = null;
        setState(s => ({ ...s, running: false }));
      }
    }
  }, [apiUrl, cancelRun]);

  const stop = useCallback(() => cancelRun('user'), [cancelRun]);
  return { ...state, start, stop };
}
