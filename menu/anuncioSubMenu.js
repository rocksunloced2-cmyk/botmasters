const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');

const sessao          = require('./anuncioSessao');
const { rowTraduzir } = require('./traduzirHandler');

// ─── Helper: exibe info de um botão salvo ─────────────────────────────────────
function infoBtn(b) {
  if (!b) return '_não configurado_';
  return `**${b.nome}**\n${b.url.slice(0, 40)}...\n${b.cor ? `cor: \`${b.cor}\`` : ''}`;
}

// ─── Monta e envia/atualiza o sub-menu ───────────────────────────────────────
async function enviarSubMenu(interaction, editar = false) {
  const uid = interaction.user.id;
  const s   = sessao.obter(uid) ?? sessao.nova(uid);
  const ok  = v => v ? '✅' : '⬜';

  const embed = new EmbedBuilder()
    .setTitle('📢 Configurar Anúncio')
    .setDescription(
      'Preencha as seções abaixo e clique em **Publicar** quando estiver pronto.\n' +
      '> Canal, Título e Conteúdo são obrigatórios.'
    )
    .setColor(s.cor ? parseInt(s.cor.replace('#', ''), 16) : 0x5865F2)
    .addFields(
      { name: `${ok(s.canal)} Canal`,      value: s.canal     ? `<#${s.canal}>` : '_não definido_',                                                 inline: true  },
      { name: `${ok(s.titulo)} Título`,    value: s.titulo    ? `**${s.titulo}**` : '_não definido_',                                               inline: true  },
      { name: `${ok(s.cor)} Cor`,          value: s.cor       ? `\`${s.cor}\`` : '_padrão #FFD700_',                                                inline: true  },
      { name: `${ok(s.descricao)} Conteúdo`, value: s.descricao ? s.descricao.slice(0, 80) + (s.descricao.length > 80 ? '...' : '') : '_não definido_', inline: false },
      { name: `${ok(s.imagem)} Imagem`,    value: s.imagem    ? `[ver imagem](${s.imagem})` : '_não definida_',                                     inline: true  },
      { name: `${ok(s.botao1)} Botão 1`,   value: infoBtn(s.botao1),                                                                                inline: true  },
      { name: `${ok(s.botao2)} Botão 2`,   value: infoBtn(s.botao2),                                                                                inline: true  },
      { name: `${ok(s.botao3)} Botão 3`,   value: infoBtn(s.botao3),                                                                                inline: true  },
    )
    .setFooter({ text: 'Sessão expira em 30 min de inatividade' });

  if (s.imagem) embed.setThumbnail(s.imagem);

  const podePub = sessao.podePublicar(uid);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('an_canal')    .setLabel('📡 Canal')       .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('an_titulo')   .setLabel('✏️ Título e Cor').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('an_conteudo') .setLabel('📝 Conteúdo')    .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('an_imagem')   .setLabel('🖼️ Imagem')      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('an_botao1').setLabel('🔗 Botão 1').setStyle(s.botao1 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('an_botao2').setLabel('🔗 Botão 2').setStyle(s.botao2 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('an_botao3').setLabel('🔗 Botão 3').setStyle(s.botao3 ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('an_publicar')
      .setLabel('🚀 Publicar Anúncio')
      .setStyle(podePub ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!podePub),
    new ButtonBuilder().setCustomId('an_cancelar')
      .setLabel('🗑️ Cancelar')
      .setStyle(ButtonStyle.Danger),
  );

  const payload = { embeds: [embed], components: [row1, row2, row3] };
  if (editar) return interaction.update(payload);
  return interaction.reply({ ...payload, flags: 64 });
}

// ─── Modal: canal ─────────────────────────────────────────────────────────────
async function modalCanal(interaction) {
  const s = sessao.obter(interaction.user.id) ?? {};
  const modal = new ModalBuilder().setCustomId('anm_canal').setTitle('📡 Canal de Destino');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('canal_id').setLabel('ID do canal de destino')
        .setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder('Ex: 1234567890123456789').setValue(s.canal ?? '')
    ),
  );
  await interaction.showModal(modal);
}

// ─── Modal: título e cor ──────────────────────────────────────────────────────
async function modalTitulo(interaction) {
  const s = sessao.obter(interaction.user.id) ?? {};
  const modal = new ModalBuilder().setCustomId('anm_titulo').setTitle('✏️ Título e Cor');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('titulo').setLabel('Título do anúncio')
        .setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true)
        .setValue(s.titulo ?? '')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('cor').setLabel('Cor em hex (opcional, padrão: #FFD700)')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('#FFD700').setValue(s.cor ?? '')
    ),
  );
  await interaction.showModal(modal);
}

// ─── Modal: conteúdo ──────────────────────────────────────────────────────────
async function modalConteudo(interaction) {
  const s = sessao.obter(interaction.user.id) ?? {};
  const modal = new ModalBuilder().setCustomId('anm_conteudo').setTitle('📝 Conteúdo do Anúncio');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('descricao').setLabel('Conteúdo / descrição')
        .setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setRequired(true)
        .setValue(s.descricao ?? '')
    ),
  );
  await interaction.showModal(modal);
}

// ─── Modal: imagem ────────────────────────────────────────────────────────────
async function modalImagem(interaction) {
  const s = sessao.obter(interaction.user.id) ?? {};
  const modal = new ModalBuilder().setCustomId('anm_imagem').setTitle('🖼️ Imagem do Anúncio');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('imagem').setLabel('URL da imagem (vazio = remover)')
        .setStyle(TextInputStyle.Paragraph).setMaxLength(512).setRequired(false)
        .setPlaceholder('https://cdn.discordapp.com/...').setValue(s.imagem ?? '')
    ),
  );
  await interaction.showModal(modal);
}

// ─── Modal: botão individual (1, 2 ou 3) ─────────────────────────────────────
async function modalBotao(interaction, num) {
  const s   = sessao.obter(interaction.user.id) ?? {};
  const key = `botao${num}`;
  const b   = s[key] ?? {};

  const modal = new ModalBuilder()
    .setCustomId(`anm_botao${num}`)
    .setTitle(`🔗 Botão ${num}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('nome').setLabel('Nome do botão')
        .setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)
        .setPlaceholder('Ex: Entrar no servidor').setValue(b.nome ?? '')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('url').setLabel('Link (URL)')
        .setStyle(TextInputStyle.Paragraph).setMaxLength(512).setRequired(true)
        .setPlaceholder('https://...').setValue(b.url ?? '')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('cor').setLabel('Cor do botão em hex (opcional)')
        .setStyle(TextInputStyle.Short).setRequired(false)
        .setPlaceholder('#5865F2 (deixe vazio para cinza padrão)').setValue(b.cor ?? '')
    ),
  );

  await interaction.showModal(modal);
}

// ─── Processar modals ─────────────────────────────────────────────────────────
async function processarCanal(interaction) {
  const canalId = interaction.fields.getTextInputValue('canal_id').trim();
  const canal   = interaction.guild.channels.cache.get(canalId);
  if (!canal || canal.type !== ChannelType.GuildText) {
    return interaction.reply({ content: `❌ Canal \`${canalId}\` não encontrado ou não é de texto.`, flags: 64 });
  }
  sessao.atualizar(interaction.user.id, { canal: canalId });
  await enviarSubMenu(interaction, true);
}

async function processarTitulo(interaction) {
  const titulo = interaction.fields.getTextInputValue('titulo').trim();
  const corRaw = interaction.fields.getTextInputValue('cor').trim();
  let cor = null;
  if (corRaw) {
    const hex = corRaw.replace('#', '');
    if (/^[0-9a-fA-F]{3,6}$/.test(hex)) cor = `#${hex}`;
  }
  sessao.atualizar(interaction.user.id, { titulo, cor: cor ?? sessao.obter(interaction.user.id)?.cor ?? null });
  await enviarSubMenu(interaction, true);
}

async function processarConteudo(interaction) {
  const descricao = interaction.fields.getTextInputValue('descricao').trim();
  sessao.atualizar(interaction.user.id, { descricao });
  await enviarSubMenu(interaction, true);
}

async function processarImagem(interaction) {
  const imagem = interaction.fields.getTextInputValue('imagem').trim() || null;
  if (imagem) {
    try { new URL(imagem); } catch {
      return interaction.reply({ content: '❌ URL inválida. Deve começar com `https://`', flags: 64 });
    }
  }
  sessao.atualizar(interaction.user.id, { imagem });
  await enviarSubMenu(interaction, true);
}

async function processarBotao(interaction, num) {
  const nome   = interaction.fields.getTextInputValue('nome').trim();
  const url    = interaction.fields.getTextInputValue('url').trim();
  const corRaw = interaction.fields.getTextInputValue('cor').trim();

  // Valida URL
  try { new URL(url); } catch {
    return interaction.reply({ content: '❌ URL inválida. Deve começar com `https://`', flags: 64 });
  }
  if (url.length > 512) {
    return interaction.reply({ content: '❌ URL muito longa (máximo 512 caracteres).', flags: 64 });
  }

  // Valida cor opcional
  let cor = null;
  if (corRaw) {
    const hex = corRaw.replace('#', '');
    if (/^[0-9a-fA-F]{3,6}$/.test(hex)) cor = `#${hex}`;
  }

  sessao.atualizar(interaction.user.id, { [`botao${num}`]: { nome, url, cor } });
  await enviarSubMenu(interaction, true);
}

// ─── Publicar anúncio ─────────────────────────────────────────────────────────
async function publicar(interaction) {
  const uid = interaction.user.id;
  const s   = sessao.obter(uid);

  if (!sessao.podePublicar(uid)) {
    return interaction.reply({ content: '❌ Preencha pelo menos Canal, Título e Conteúdo.', flags: 64 });
  }

  const canal = interaction.guild.channels.cache.get(s.canal);
  if (!canal) return interaction.reply({ content: '❌ Canal não encontrado.', flags: 64 });

  // Cor do embed
  let cor = 0xFFD700;
  if (s.cor) { try { cor = parseInt(s.cor.replace('#', ''), 16); } catch { /* padrão */ } }

  // Embed
  const embed = new EmbedBuilder()
    .setTitle(s.titulo)
    .setDescription(s.descricao)
    .setColor(cor)
    .setTimestamp()
    .setFooter({ text: `Anúncio por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

  if (s.imagem) embed.setImage(s.imagem);

  // Botões de link individuais
  const botoesLink = [];
  for (const key of ['botao1', 'botao2', 'botao3']) {
    const b = s[key];
    if (!b?.nome || !b?.url) continue;
    // Cor do botão: o Discord só suporta Link style (cinza) — cor hex não é suportada pela API
    // mas guardamos para exibição no sub-menu
    botoesLink.push(
      new ButtonBuilder()
        .setLabel(b.nome.slice(0, 80))
        .setURL(b.url)
        .setStyle(ButtonStyle.Link)
    );
  }

  const components = [];
  if (botoesLink.length) components.push(new ActionRowBuilder().addComponents(...botoesLink));
  components.push(rowTraduzir('anuncio'));

  await interaction.deferUpdate();

  try {
    await canal.send({ content: '@everyone', embeds: [embed], components });
    sessao.limpar(uid);
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Anúncio Publicado!')
        .setDescription(`O anúncio foi enviado em ${canal}!`)
        .setColor(0x57F287)],
      components: [],
    });
  } catch (err) {
    console.error('Erro ao publicar anúncio:', err.message);
    await interaction.editReply({ content: `❌ Erro ao enviar: \`${err.message}\``, embeds: [], components: [] });
  }
}

// ─── Cancelar ─────────────────────────────────────────────────────────────────
async function cancelar(interaction) {
  sessao.limpar(interaction.user.id);
  await interaction.update({
    embeds: [new EmbedBuilder().setTitle('🗑️ Anúncio cancelado').setColor(0xED4245)],
    components: [],
  });
}

module.exports = {
  enviarSubMenu,
  modalCanal, modalTitulo, modalConteudo, modalImagem, modalBotao,
  processarCanal, processarTitulo, processarConteudo, processarImagem, processarBotao,
  publicar, cancelar,
};
