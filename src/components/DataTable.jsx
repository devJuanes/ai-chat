import { useMemo, useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(headers, rows) {
  const escape = (cell) => {
    const s = String(cell ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

/** Excel XML Spreadsheet (abre en Excel sin librerías). */
function toExcelXml(headers, rows) {
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const cell = (v) =>
    `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const headerRow = `<Row>${headers.map(cell).join('')}</Row>`;
  const body = rows.map((r) => `<Row>${r.map(cell).join('')}</Row>`).join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Datos">
  <Table>${headerRow}${body}</Table>
 </Worksheet>
</Workbook>`;
}

export function parseDelimited(text, sep = ',') {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQ = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === sep) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const matrix = lines.map(splitLine);
  const headers = matrix[0];
  const rows = matrix.slice(1);
  return { headers, rows };
}

export default function DataTable({
  headers = [],
  rows = [],
  caption,
  filename = 'datos',
}) {
  const [copied, setCopied] = useState(false);
  const safeHeaders = headers.length
    ? headers
    : rows[0]?.map((_, i) => `Col ${i + 1}`) || [];
  const safeRows = headers.length ? rows : rows.slice(1);

  const csvText = useMemo(
    () => toCsv(safeHeaders, safeRows),
    [safeHeaders, safeRows]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csvText.replace(/^\uFEFF/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  if (!safeHeaders.length) return null;

  return (
    <div className="my-1 w-full min-w-0 overflow-hidden rounded-xl border border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-[#f7f7f8] px-2.5 py-2 sm:gap-2 sm:px-3">
        <span className="text-[12px] font-medium text-mid-ash">
          {caption || 'Tabla'}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[12px] font-medium text-mid-ash hover:bg-white hover:text-graphite-ink"
          onClick={copy}
        >
          {copied ? (
            <span className="inline-flex items-center gap-1">
              <CheckIcon className="h-3.5 w-3.5" /> Copiado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CopyIcon className="h-3.5 w-3.5" /> Copiar
            </span>
          )}
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[12px] font-medium text-mid-ash hover:bg-white hover:text-graphite-ink"
          onClick={() =>
            downloadBlob(
              `${filename}.csv`,
              new Blob([csvText], { type: 'text/csv;charset=utf-8' })
            )
          }
        >
          CSV
        </button>
        <button
          type="button"
          className="rounded-lg bg-graphite-ink px-2.5 py-1 text-[12px] font-medium text-pure-white hover:bg-ink-press"
          onClick={() =>
            downloadBlob(
              `${filename}.xls`,
              new Blob([toExcelXml(safeHeaders, safeRows)], {
                type: 'application/vnd.ms-excel',
              })
            )
          }
        >
          Excel
        </button>
      </div>

      {/* Móvil: cards apiladas (legibles sin scroll horizontal) */}
      <div className="flex max-h-[min(60vh,480px)] flex-col gap-2 overflow-y-auto p-2 sm:hidden">
        {safeRows.map((row, ri) => (
          <div
            key={ri}
            className="rounded-lg border border-hairline bg-[#fafafa] px-3 py-2.5"
          >
            {safeHeaders.map((h, ci) => (
              <div
                key={ci}
                className={`grid grid-cols-[minmax(0,38%)_minmax(0,62%)] gap-2 py-1.5 text-[13px] ${
                  ci > 0 ? 'border-t border-hairline/80' : ''
                }`}
              >
                <span className="font-semibold leading-snug text-graphite-ink">
                  {h}
                </span>
                <span className="min-w-0 break-words leading-snug text-mid-ash">
                  {row[ci] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop / tablet: tabla con scroll si hace falta */}
      <div className="hidden max-h-[420px] overflow-auto sm:block">
        <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-hairline bg-[#fafafa]">
              {safeHeaders.map((h, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap px-3 py-2.5 font-semibold text-graphite-ink"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-hairline last:border-0 odd:bg-white even:bg-[#fcfcfc] hover:bg-[#f5f5f5]"
              >
                {safeHeaders.map((_, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 align-top text-graphite-ink"
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
