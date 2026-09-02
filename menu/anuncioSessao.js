/**
 * Sessões temporárias de criação de anúncio por usuário.
 * Expiram em 30 minutos de inatividade.
 */

const sessoes = new Map();
const TTL = 30 * 60 * 1000;

function obter(userId) {
  return sessoes.get(userId)?.dados ?? null;
}

function salvar(userId, dados) {
  const antiga = sessoes.get(userId);
  if (antiga?.timeout) clearTimeout(antiga.timeout);
  const timeout = setTimeout(() => sessoes.delete(userId), TTL);
  sessoes.set(userId, { dados, timeout });
}

function atualizar(userId, patch) {
  const atual = obter(userId) ?? {};
  salvar(userId, { ...atual, ...patch });
  return obter(userId);
}

function limpar(userId) {
  const antiga = sessoes.get(userId);
  if (antiga?.timeout) clearTimeout(antiga.timeout);
  sessoes.delete(userId);
}

function nova(userId) {
  salvar(userId, {
    canal:    null,
    titulo:   null,
    descricao: null,
    imagem:   null,
    cor:      null,
    botao1:   null,   // { nome, url, cor }
    botao2:   null,
    botao3:   null,
  });
  return obter(userId);
}

function podePublicar(userId) {
  const s = obter(userId);
  if (!s) return false;
  return !!(s.canal && s.titulo && s.descricao);
}

module.exports = { obter, salvar, atualizar, limpar, nova, podePublicar };
