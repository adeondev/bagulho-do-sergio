const SAVE_KEY = "mundo_vivo_save_v2";

export function temSave() {
  try { return Boolean(localStorage.getItem(SAVE_KEY)); }
  catch { return false; }
}

export function salvar(estado) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...estado, salvoEm: Date.now() }));
    return true;
  } catch (erro) {
    console.warn("Falha ao salvar:", erro);
    return false;
  }
}

export function carregar() {
  try {
    const bruto = localStorage.getItem(SAVE_KEY);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    if (!dados || typeof dados.seed !== "number") return null;
    return dados;
  } catch (erro) {
    console.warn("Falha ao carregar:", erro);
    return null;
  }
}

export function apagar() {
  try { localStorage.removeItem(SAVE_KEY); }
  catch (erro) { console.warn("Falha ao apagar save:", erro); }
}

export function dataSave() {
  const dados = carregar();
  return dados?.salvoEm ? new Date(dados.salvoEm) : null;
}
