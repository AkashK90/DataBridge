// ── Helpers ────────────────────────────────────────────────────────────────────
function triggerBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function flattenEvent(ev) {
  return {
    id:          ev.id ?? '',
    timestamp:   ev.timestamp ?? '',
    status:      ev.status ?? '',
    contentType: ev.contentType ?? '',
    data:        typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
  };
}

// ── JSON ───────────────────────────────────────────────────────────────────────
export function downloadJSON(events, filename = 'events') {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  triggerBlob(blob, `${filename}.json`);
}

// ── CSV ────────────────────────────────────────────────────────────────────────
export function downloadCSV(events, filename = 'events') {
  const headers = ['id', 'timestamp', 'status', 'contentType', 'data'];
  const rows = events.map((ev) => {
    const flat = flattenEvent(ev);
    return headers.map((h) => `"${String(flat[h]).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerBlob(blob, `${filename}.csv`);
}

// ── PDF ────────────────────────────────────────────────────────────────────────
export async function downloadPDF(events, title = 'API Events Report') {
  // Dynamic import keeps jspdf out of the initial bundle
  const { jsPDF }              = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape' });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text(title, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.text(`Total events: ${events.length}`, 14, 30);

  // Summary line
  const ok   = events.filter((e) => e.status >= 200 && e.status < 300).length;
  const warn = events.filter((e) => e.status >= 400 && e.status < 500).length;
  const err  = events.filter((e) => e.status >= 500).length;
  doc.text(`Success: ${ok}   Client errors: ${warn}   Server errors: ${err}`, 14, 35);

  // Table
  autoTable(doc, {
    startY: 40,
    head: [['#', 'Timestamp', 'Status', 'Content-Type', 'Data Preview']],
    body: events.map((ev, i) => [
      i + 1,
      new Date(ev.timestamp).toLocaleString(),
      ev.status,
      ev.contentType || '—',
      (typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)).slice(0, 120)
    ]),
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 40 },
      2: { cellWidth: 18 },
      3: { cellWidth: 50 },
      4: { cellWidth: 'auto' }
    },
    margin: { left: 14, right: 14 }
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
