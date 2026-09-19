import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckIcon, CopyIcon } from './Icons';

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function tableToMatrix(tableEl) {
  if (!tableEl) return { headers: [], rows: [] };
  const headers = [...tableEl.querySelectorAll('thead th')].map((th) =>
    th.textContent.trim()
  );
  const bodyRows = [...tableEl.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())
  );
  if (headers.length) return { headers, rows: bodyRows };
  const all = [...tableEl.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((c) => c.textContent.trim())
  );
  return { headers: all[0] || [], rows: all.slice(1) };
}

function toCsv(headers, rows) {
  const escape = (cell) => {
    const s = String(cell ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return `\uFEFF${[headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')}`;
}

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
 <Worksheet ss:Name="Datos"><Table>${headerRow}${body}</Table></Worksheet>
</Workbook>`;
}

function MarkdownTable({ children, isUser }) {
  const tableRef = useRef(null);
  const [copied, setCopied] = useState(false);

  if (isUser) {
    return (
      <div className="my-2 overflow-x-auto">
        <table
          ref={tableRef}
          className="w-full border-collapse text-[13px] text-pure-white"
        >
          {children}
        </table>
      </div>
    );
  }

  const exportMatrix = () => tableToMatrix(tableRef.current);

  const copy = async () => {
    const { headers, rows } = exportMatrix();
    try {
      await navigator.clipboard.writeText(
        toCsv(headers, rows).replace(/^\uFEFF/, '')
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="my-1 w-full min-w-0 overflow-hidden rounded-xl border border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-[#f7f7f8] px-2.5 py-2 sm:gap-2 sm:px-3">
        <span className="text-[12px] font-medium text-mid-ash">Tabla</span>
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
          onClick={() => {
            const { headers, rows } = exportMatrix();
            downloadBlob(
              'tabla-matu.csv',
              new Blob([toCsv(headers, rows)], {
                type: 'text/csv;charset=utf-8',
              })
            );
          }}
        >
          CSV
        </button>
        <button
          type="button"
          className="rounded-lg bg-graphite-ink px-2.5 py-1 text-[12px] font-medium text-pure-white hover:bg-ink-press"
          onClick={() => {
            const { headers, rows } = exportMatrix();
            downloadBlob(
              'tabla-matu.xls',
              new Blob([toExcelXml(headers, rows)], {
                type: 'application/vnd.ms-excel',
              })
            );
          }}
        >
          Excel
        </button>
      </div>
      <div className="max-h-[min(60vh,420px)] overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch]">
        <table
          ref={tableRef}
          className="w-full min-w-[480px] border-collapse text-left text-[13px]"
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export default function RichMarkdown({ content, isUser = false }) {
  if (!content?.trim()) return null;

  const components = {
    p: ({ children }) => (
      <p
        className={`mb-2 last:mb-0 leading-relaxed ${
          isUser ? 'text-pure-white' : 'text-graphite-ink'
        }`}
      >
        {children}
      </p>
    ),
    h1: ({ children }) => (
      <h3
        className={`mb-2 text-base font-semibold leading-snug ${
          isUser ? 'text-pure-white' : 'text-graphite-ink'
        }`}
      >
        {children}
      </h3>
    ),
    h2: ({ children }) => (
      <h3
        className={`mb-2 text-[15px] font-semibold ${
          isUser ? 'text-pure-white' : 'text-graphite-ink'
        }`}
      >
        {children}
      </h3>
    ),
    h3: ({ children }) => (
      <h3
        className={`mb-1.5 text-sm font-semibold ${
          isUser ? 'text-pure-white' : 'text-graphite-ink'
        }`}
      >
        {children}
      </h3>
    ),
    ul: ({ children }) => (
      <ul className="mb-2 flex list-disc flex-col gap-1 pl-5 last:mb-0">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 flex list-decimal flex-col gap-1 pl-5 last:mb-0">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={isUser ? 'text-pure-white' : 'text-graphite-ink'}>
        {children}
      </li>
    ),
    strong: ({ children }) => (
      <strong
        className={`font-semibold ${
          isUser ? 'text-pure-white' : 'text-graphite-ink'
        }`}
      >
        {children}
      </strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    a: ({ href, children }) =>
      isUser ? (
        <span className="underline">{children}</span>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-graphite-ink underline decoration-hairline underline-offset-2 hover:decoration-graphite-ink"
        >
          {children}
        </a>
      ),
    blockquote: ({ children }) => (
      <blockquote
        className={`my-2 border-l-2 pl-3 ${
          isUser
            ? 'border-white/40 text-white/90'
            : 'border-hairline text-mid-ash'
        }`}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr
        className={`my-3 border-0 border-t ${
          isUser ? 'border-white/20' : 'border-hairline'
        }`}
      />
    ),
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className || '');
      if (isBlock) return <code className={className}>{children}</code>;
      return (
        <code
          className={`rounded-md border px-1.5 py-px font-mono text-[0.88em] ${
            isUser
              ? 'border-white/20 bg-black/20 text-pure-white'
              : 'border-hairline bg-[#f0f0f0] text-graphite-ink'
          }`}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => <>{children}</>,
    table: ({ children }) => (
      <MarkdownTable isUser={isUser}>{children}</MarkdownTable>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-hairline bg-[#fafafa]">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-hairline last:border-0 odd:bg-white even:bg-[#fcfcfc]">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-graphite-ink">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 align-top text-graphite-ink">{children}</td>
    ),
  };

  return (
    <div className="rich-md text-[15px] leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
