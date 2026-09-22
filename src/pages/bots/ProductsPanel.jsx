import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PlusIcon, TrashIcon, CloseIcon } from '../../components/Icons';

const TYPE_LABEL = {
  physical: 'Físico',
  digital: 'Digital',
  service: 'Servicio',
};

const EMPTY = {
  name: '',
  description: '',
  price: '',
  currency: 'COP',
  product_type: 'service',
  stock: '',
  image_url: '',
  purchase_link: '',
  tags: '',
  hide_price: false,
  active: true,
};

function StatusSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-black transition ${
        checked ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full border-2 border-black bg-white transition-transform ${
          checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function EmptyState({ title, hint, action }) {
  return (
    <div className="flex min-h-[min(48vh,380px)] flex-col items-center justify-center px-6 text-center">
      <p className="text-[22px] font-semibold tracking-tight sm:text-[26px]">
        {title}
      </p>
      {hint ? (
        <p className="mt-3 max-w-md text-[15px] opacity-55">{hint}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl border-2 border-black bg-[#faf8f5] shadow-[6px_6px_0_#000] sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b-2 border-black px-4 py-4">
          <h3 className="min-w-0 flex-1 text-[16px] font-semibold">{title}</h3>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black bg-[#f4ed36]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function ProductsPanel({ token, onNotice, onError }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api('/api/catalog/products', { token });
      setProducts(res.products || []);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const open = () => openNew();
    window.addEventListener('bots:new-product', open);
    return () => window.removeEventListener('bots:new-product', open);
  }, []);

  const openNew = () => {
    setEditing('new');
    setDraft({ ...EMPTY });
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setDraft({
      name: p.name,
      description: p.description || '',
      price: p.price == null ? '' : String(p.price),
      currency: p.currency || 'COP',
      product_type: p.product_type || 'service',
      stock: p.stock == null ? '' : String(p.stock),
      image_url: p.image_url || '',
      purchase_link: p.purchase_link || '',
      tags: p.tags || '',
      hide_price: p.hide_price === true,
      active: p.active !== false,
    });
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        ...draft,
        name: draft.name.trim(),
        price: draft.price === '' ? null : Number(draft.price),
        stock: draft.stock === '' ? null : Number(draft.stock),
      };
      if (editing === 'new') {
        await api('/api/catalog/products', { token, method: 'POST', body });
        onNotice?.('Producto creado');
      } else {
        await api(`/api/catalog/products/${editing}`, {
          token,
          method: 'PATCH',
          body,
        });
        onNotice?.('Producto guardado');
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p, next) => {
    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, active: next } : x))
    );
    try {
      await api(`/api/catalog/products/${p.id}`, {
        token,
        method: 'PATCH',
        body: { active: next },
      });
    } catch (err) {
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, active: !next } : x))
      );
      onError?.(err.message);
    }
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold tracking-tight">
            Productos y servicios
          </h2>
          <p className="text-[13px] opacity-70">
            Solo esto puede ofrecer el agente. Si no está aquí, no lo inventa.
          </p>
        </div>
        <button
          type="button"
          className="fp-btn inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] font-medium"
          onClick={openNew}
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {loading ? (
        <EmptyState title="Cargando…" />
      ) : products.length === 0 ? (
        <EmptyState
          title="Aún no hay productos"
          hint="Sube lo que vendes: precio, tipo, link y descripción. Así el agente no inventa ofertas."
          action={
            <button
              type="button"
              className="rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[14px] font-medium"
              onClick={openNew}
            >
              Nuevo producto
            </button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => openEdit(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openEdit(p);
                }}
                className="flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-black bg-white text-left transition hover:bg-[#faf8f5]"
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-32 w-full border-b-2 border-black object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center border-b-2 border-black bg-[#faf8f5] text-[12px] opacity-40">
                    Sin imagen
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="fp-mono text-[10px] uppercase opacity-50">
                        {TYPE_LABEL[p.product_type] || p.product_type}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <StatusSwitch
                        checked={p.active !== false}
                        onChange={(n) => toggle(p, n)}
                      />
                    </div>
                  </div>
                  <p className="line-clamp-2 text-[12px] opacity-70">
                    {p.description || 'Sin descripción'}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span className="text-[13px] font-medium">
                      {p.hide_price
                        ? 'Precio oculto'
                        : p.price != null
                          ? `${p.currency} ${Number(p.price).toLocaleString('es-CO')}`
                          : 'Precio a confirmar'}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border-2 border-black bg-white p-1.5 opacity-70 hover:opacity-100"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm('¿Eliminar producto?')) return;
                        try {
                          await api(`/api/catalog/products/${p.id}`, {
                            token,
                            method: 'DELETE',
                          });
                          await refresh();
                        } catch (err) {
                          onError?.(err.message);
                        }
                      }}
                      aria-label="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal
          title={editing === 'new' ? 'Nuevo producto' : 'Editar producto'}
          onClose={() => setEditing(null)}
        >
          <div className="grid gap-3">
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="fp-mono opacity-70">Nombre</span>
              <input
                className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="fp-mono opacity-70">Descripción</span>
              <textarea
                className="min-h-[88px] rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="fp-mono opacity-70">Tipo</span>
                <select
                  className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                  value={draft.product_type}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, product_type: e.target.value }))
                  }
                >
                  <option value="service">Servicio</option>
                  <option value="digital">Digital</option>
                  <option value="physical">Físico</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="fp-mono opacity-70">Precio</span>
                <input
                  type="number"
                  className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                  value={draft.price}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, price: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="fp-mono opacity-70">Moneda</span>
                <input
                  className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, currency: e.target.value }))
                  }
                />
              </label>
            </div>
            {draft.product_type === 'physical' ? (
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="fp-mono opacity-70">Stock</span>
                <input
                  type="number"
                  className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                  value={draft.stock}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, stock: e.target.value }))
                  }
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="fp-mono opacity-70">URL de imagen</span>
              <input
                className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                value={draft.image_url}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, image_url: e.target.value }))
                }
                placeholder="https://…"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="fp-mono opacity-70">Link de compra</span>
              <input
                className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                value={draft.purchase_link}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, purchase_link: e.target.value }))
                }
                placeholder="https://…"
              />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={draft.hide_price === true}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, hide_price: e.target.checked }))
                }
              />
              No decir el precio al cliente (el agente no lo menciona)
            </label>
            <div className="flex gap-2 border-t-2 border-black pt-3">
              <button
                type="button"
                disabled={saving || !draft.name.trim()}
                className="rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
                onClick={save}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="rounded-lg border-2 border-black bg-white px-4 py-2 text-[13px]"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
