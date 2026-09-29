import { useState } from 'react';
import AgentLoader from './AgentLoader';
import MatuAvatar from './MatuAvatar';
import CodeBlock from './CodeBlock';
import DataTable, { parseDelimited } from './DataTable';
import RichMarkdown from './RichMarkdown';
import SportsSlate from './SportsSlate';
import {
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  ThumbDownIcon,
  ThumbUpIcon,
  UserIcon,
} from './Icons';

/** Extrae fences ```lang ... ``` y deja el resto como texto. */
function tokenize(text) {
  const parts = [];
  const re = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n?([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', content: text.slice(last, match.index) });
    }
    parts.push({
      type: 'code',
      lang: match[1] || 'text',
      content: match[2].replace(/\n$/, ''),
    });
    last = match.index + match[0].length;
  }

  const remaining = text.slice(last);
  const openIdx = remaining.indexOf('```');
  if (openIdx !== -1) {
    if (openIdx > 0) {
      parts.push({ type: 'text', content: remaining.slice(0, openIdx) });
    }
    const after = remaining.slice(openIdx + 3);
    const langMatch = after.match(/^([a-zA-Z0-9_+-]*)[ \t]*\r?\n?/);
    const lang = langMatch?.[1] || '';
    const codeStart = langMatch ? langMatch[0].length : 0;
    parts.push({
      type: 'code',
      lang: lang || 'text',
      content: after.slice(codeStart),
      streaming: true,
    });
  } else if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  return parts.length ? parts : [{ type: 'text', content: text }];
}

function isDataLang(lang) {
  const l = String(lang || '').toLowerCase();
  return l === 'csv' || l === 'tsv' || l === 'excel';
}

function renderContent(text, isUser, { flushCode = false, streaming = false } = {}) {
  const tokens = tokenize(text);
  return tokens.map((tok, i) => {
    if (tok.type === 'code') {
      if (!isUser && String(tok.lang).toLowerCase() === 'sports') {
        let cards = [];
        try {
          cards = JSON.parse(tok.content);
        } catch {
          cards = [];
        }
        if (Array.isArray(cards) && cards.length) {
          return <SportsSlate key={`sports-${i}`} cards={cards} />;
        }
        if (tok.streaming) {
          return (
            <p key={`sports-${i}`} className="px-3 py-2 text-[13px] font-medium opacity-60">
              Armando los pronósticos…
            </p>
          );
        }
        return null;
      }
      if (!isUser && isDataLang(tok.lang) && tok.content.trim()) {
        const sep = tok.lang.toLowerCase() === 'tsv' ? '\t' : ',';
        const { headers, rows } = parseDelimited(tok.content, sep);
        if (headers.length) {
          return (
            <div key={`data-${i}`} className={flushCode ? 'px-2 py-2 sm:px-3' : ''}>
              <DataTable
                headers={headers}
                rows={rows}
                caption="Datos"
                filename="export-matu"
              />
            </div>
          );
        }
      }
      return (
        <CodeBlock
          key={`code-${i}`}
          code={tok.content}
          language={tok.lang}
          isUser={isUser}
          streaming={Boolean(streaming && tok.streaming)}
        />
      );
    }
    return (
      <div
        key={`text-${i}`}
        className={flushCode ? 'px-3 py-2.5 first:pt-3 last:pb-3 sm:px-4' : ''}
      >
        <RichMarkdown content={tok.content} isUser={isUser} />
      </div>
    );
  });
}

function Actions({ onCopy, onRegenerate, onFeedback, onContinue, feedback }) {
  const btn =
    'inline-flex h-7 w-7 items-center justify-center rounded-[10px] text-mid-ash hover:bg-hover-veil hover:text-graphite-ink';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onContinue ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-black bg-[#f4ed36] px-3 text-[11px] font-bold text-black hover:bg-[#f9cc73]"
          onClick={onContinue}
        >
          Continuar generando
        </button>
      ) : null}
      <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      <button type="button" className={btn} onClick={onCopy} aria-label="Copiar">
        <CopyIcon className="h-3.5 w-3.5" />
      </button>
      {onRegenerate ? (
        <button
          type="button"
          className={btn}
          onClick={onRegenerate}
          aria-label="Regenerar"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onFeedback ? (
        <>
          <button
            type="button"
            className={`${btn} ${feedback === 'up' ? 'bg-hover-veil text-graphite-ink' : ''}`}
            onClick={() => onFeedback('up')}
            aria-label="Útil"
          >
            <ThumbUpIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={`${btn} ${feedback === 'down' ? 'bg-hover-veil text-graphite-ink' : ''}`}
            onClick={() => onFeedback('down')}
            aria-label="No útil"
          >
            <ThumbDownIcon className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
      </div>
    </div>
  );
}

export default function Message({
  message,
  onRegenerate,
  onFeedback,
  onContinue,
  streaming,
  incomplete = false,
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isUser = message.role === 'user';
  const visibleContent = (message.content || '')
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\/?think(?:ing)?>/gi, '')
    .trim();
  const isTyping = Boolean(streaming) && !isUser && !visibleContent;
  const hasCode = /```/.test(visibleContent);
  const codeStreaming =
    !isUser &&
    Boolean(streaming) &&
    hasCode &&
    tokenize(visibleContent).some((part) => part.type === 'code' && part.streaming);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(visibleContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const giveFeedback = async (v) => {
    setFeedback(v);
    try {
      await onFeedback?.(v);
    } catch {
      /* ignore */
    }
  };

  return (
    <article
      className={`group flex w-full min-w-0 items-end gap-2 sm:gap-3 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {isUser ? (
        <div
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] text-black sm:h-8 sm:w-8"
          aria-hidden="true"
        >
          <UserIcon className="h-4 w-4" />
        </div>
      ) : (
        <MatuAvatar size={32} decorative />
      )}

      <div
        className={`flex min-w-0 max-w-full flex-1 flex-col gap-1 sm:gap-1.5 ${
          isUser
            ? 'items-end'
            : hasCode
              ? 'items-stretch'
              : 'items-start'
        }`}
      >
        <div
          className={`flex items-center gap-2 px-0.5 ${
            isUser ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.05em] text-black/45 sm:text-[11px]"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {isUser ? 'Tú' : 'Matu'}
          </span>
          {streaming && !isUser && <AgentLoader size="sm" />}
        </div>

        <div
          className={`max-w-full min-w-0 text-[15px] leading-relaxed sm:text-base ${
            isUser
              ? 'w-fit max-w-full break-words rounded-[6px] rounded-br-[2px] border-2 border-black bg-[#1a1a1a] px-3 py-2.5 text-[#f9f5f2] [overflow-wrap:anywhere] sm:px-4 sm:py-3'
              : isTyping
                ? 'w-fit rounded-[6px] border-0 bg-transparent px-1 py-1'
                : hasCode
                  ? `w-full overflow-hidden rounded-[6px] border-2 border-black bg-white text-[#1a1a1a] shadow-[2px_2px_0_#000] sm:border-[2.5px] sm:shadow-[3px_3px_0_#000] ${
                      codeStreaming ? 'code-msg-streaming' : ''
                    }`
                  : 'w-full max-w-full overflow-x-auto rounded-[6px] rounded-bl-[2px] border-2 border-black bg-[#f9f5f2] px-3 py-2.5 text-[#1a1a1a] sm:w-fit sm:px-4 sm:py-3'
          }`}
          aria-label={isTyping ? 'El asistente está respondiendo' : undefined}
        >
          {isTyping ? (
            <AgentLoader />
          ) : (
            <div
              className={`min-w-0 ${
                hasCode && !isUser ? '' : 'space-y-3 [&>*+*]:mt-3'
              }`}
            >
              {renderContent(visibleContent, isUser, {
                flushCode: hasCode && !isUser,
                streaming: Boolean(streaming) && !isUser,
              })}
            </div>
          )}
        </div>

        {!isUser && visibleContent && !streaming && (
          <Actions
            onCopy={copy}
            onRegenerate={() => onRegenerate?.()}
            onFeedback={giveFeedback}
            onContinue={
              incomplete && onContinue ? () => onContinue() : undefined
            }
            feedback={feedback}
          />
        )}
        {!isUser && incomplete && !streaming && (
          <p className="px-0.5 text-[12px] font-medium text-black/50">
            El HTML se cortó. Pulsa Continuar generando para seguir desde aquí.
          </p>
        )}
        {copied && (
          <span className="inline-flex items-center gap-1 text-xs text-hollow">
            <CheckIcon className="h-3 w-3" /> Copiado
          </span>
        )}
        {feedback && (
          <span className="text-xs text-mid-ash">Gracias por tu opinión</span>
        )}
      </div>
    </article>
  );
}
