import { useState, useEffect, useRef, useCallback } from 'react';

export function useEvents() {
  const [events, setEvents]           = useState([]);
  const [streamStatus, setStreamStatus] = useState('connecting');
  const seenIds = useRef(new Set());

  const addEvent = useCallback((ev) => {
    const uid = ev.id != null ? `id-${ev.id}` : `ts-${ev.timestamp}`;
    if (seenIds.current.has(uid)) return;
    seenIds.current.add(uid);
    setEvents((prev) => [...prev, ev]);
  }, []);

  // Load history once on mount
  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => (data.events || []).forEach(addEvent))
      .catch(() => {});
  }, [addEvent]);

  // SSE stream with auto-reconnect
  useEffect(() => {
    let source;

    function connect() {
      source = new EventSource('/api/stream');
      source.onopen    = () => setStreamStatus('live');
      source.onmessage = (e) => addEvent(JSON.parse(e.data));
      source.onerror   = () => {
        setStreamStatus('reconnecting');
        source.close();
        setTimeout(connect, 3000);
      };
    }

    connect();
    return () => source?.close();
  }, [addEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    seenIds.current.clear();
  }, []);

  return { events, streamStatus, clearEvents, addEvent };
}
