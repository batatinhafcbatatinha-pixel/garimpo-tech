// Estado que precisa sobreviver entre a coleta (processo separado) e o modo live (dentro do servidor):
// ofertas e cupons marcados como esgotados, e os preços de referência do catálogo do KaBuM.
// Fica em data/local/state.json.

import { loadJson } from './history.mjs';

const EMPTY = () => ({ expiredIds: {}, expiredCodes: {}, refs: {} });

export async function loadState(path) {
  const st = await loadJson(path, EMPTY());
  return { ...EMPTY(), ...st };
}

// Semeia os conjuntos em memória (EXPIRED_IDS, EXPIRED_CODES, REFS) com o que estava salvo.
export function applyState(st, { expiredIds, expiredCodes, refs }) {
  for (const id of Object.keys(st.expiredIds || {})) expiredIds.add(id);
  for (const c of Object.keys(st.expiredCodes || {})) expiredCodes.add(c);
  for (const [k, v] of Object.entries(st.refs || {})) refs.set(k, v);
}

// Junta o salvo com o que está em memória agora; descarta expirados mais velhos que keepHours.
export function captureState(prev, { expiredIds, expiredCodes, refs }, now, keepHours) {
  const cut = Date.parse(now) - keepHours * 3600e3;
  const merge = (old = {}, set) => {
    const out = {};
    for (const k of set) out[k] = old[k] || now;
    for (const [k, at] of Object.entries(old)) if (!(k in out)) out[k] = at;
    for (const [k, at] of Object.entries(out)) {
      if (Date.parse(at) >= cut) continue;
      delete out[k];
      set.delete(k); // senão, no processo longo do live, voltaria com data nova na próxima gravação
    }
    return out;
  };
  return {
    expiredIds: merge(prev.expiredIds, expiredIds),
    expiredCodes: merge(prev.expiredCodes, expiredCodes),
    refs: refs.size ? Object.fromEntries(refs) : prev.refs || {},
  };
}
