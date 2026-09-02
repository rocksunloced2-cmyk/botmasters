require('dotenv').config();

// ─── Tratamento global — DEVE ser o primeiro registro ─────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err?.message ?? err);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err?.message ?? err);
});

// ─── Garante que os arquivos de dados existam (necessário no Railway) ──────────
require('./utils/inicializarDados').inicializar();
const {
  Client, GatewayIntentBits, Partials,
  REST, Routes,
  SlashCommandBuilder,
} = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const { enviarMenu }                                  = require('./menu/menuPrincipal');
const anuncio                                         = require('./menu/anuncioHandler');
const anuncioSub                                      = require('./menu/anuncioSubMenu');
const { abrirModalTrancar, abrirModalAbrir,
        processarTrancar,  processarAbrir,
        destravaBotao }                               = require('./menu/canalHandler');
const bot                                             = require('./menu/botHandler');
const { abrirMenuIdiomas, processarTraducao }         = require('./menu/traduzirHandler');
const { participar: sorteioParticipar }               = require('./menu/sorteioCore');
const sub                                             = require('./menu/sorteioSubMenu');
const usuario                                         = require('./menu/usuarioHandler');
const avaliacao                                       = require('./menu/avaliacaoHandler');
const stats                                           = require('./menu/statsHandler');
const { recepcionarMembro, despedirMembro }           = require('./menu/bemVindoHandler');
const { iniciarBackup }                               = require('./menu/backupHandler');
const { log }                                         = require('./menu/logsHandler');
const { mostrarRanking }                              = require('./menu/avaliacaoStats');
const { iniciarStatus, onVoiceStateUpdate }           = require('./menu/canalStatusHandler');
const { iniciarProtecao }                             = require('./menu/protecaoHandler');

// ─── Constantes ────────────────────────────────────────────────────────────────
const GUILD_ID         = '1522456699082903572';
const VOICE_CHANNEL_ID = '1522518246694191284';
const CARGO_CHEFE      = '1522459532469469225';

// ─── Cliente ───────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.GuildMember],
});

// ─── Registro do único slash command ──────────────────────────────────────────
async function registrarComandos() {
  const cmd = new SlashCommandBuilder()
    .setName('menu')
    .setDescription('👑 Abre o painel de controle do Mr. Chefe')
    .toJSON();

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    console.log('📡 Registrando /menu...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: [cmd] },
    );
    console.log('✅ /menu registrado!');
  } catch (err) {
    console.error('❌ Erro ao registrar /menu:', err);
  }
}

// ─── Verifica cargo ────────────────────────────────────────────────────────────
function temCargo(interaction) {
  return interaction.member?.roles?.cache?.has(CARGO_CHEFE) ?? false;
}

function semPermissao(interaction) {
  return interaction.reply({
    content: `❌ Apenas quem possui o cargo <@&${CARGO_CHEFE}> pode usar isso.`,
    flags: 64,
  });
}

// ─── Voz ───────────────────────────────────────────────────────────────────────
async function conectarVoz(guild) {
  try {
    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
    if (!channel) { console.warn('⚠️  Canal de voz não encontrado:', VOICE_CHANNEL_ID); return; }

    const conn = joinVoiceChannel({
      channelId: VOICE_CHANNEL_ID, guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: true,
    });

    conn.on(VoiceConnectionStatus.Ready, () => console.log(`🎙️  Conectado em: ${channel.name}`));
    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
          entersState(conn, VoiceConnectionStatus.Connecting,  5_000),
        ]);
      } catch {
        console.warn('🔄 Reconectando ao canal de voz...');
        setTimeout(() => conectarVoz(guild), 5_000);
      }
    });
    conn.on('error', () => setTimeout(() => conectarVoz(guild), 5_000));
  } catch {
    setTimeout(() => conectarVoz(guild), 10_000);
  }
}

// ─── Ready ─────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`\n🤖 ${client.user.tag} online!`);
  await registrarComandos();
  const guild = client.guilds.cache.get(GUILD_ID)
    ?? await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guild) {
    conectarVoz(guild);
    avaliacao.iniciarCiclo(client);
    iniciarBackup();
    iniciarStatus(client);
    iniciarProtecao(client);
  }
});

// ─── Monitoramento de voice state (call status) ────────────────────────────────
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.guild.id !== GUILD_ID && newState.guild.id !== GUILD_ID) return;
  onVoiceStateUpdate(oldState, newState);
});

// ─── Membro entrou ─────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== GUILD_ID) return;

  if (member.user.bot) {
    const autorizados = bot.carregar();
    if (autorizados.includes(member.user.id)) { console.log(`✅ Bot autorizado: ${member.user.tag}`); return; }
    try {
      await member.kick('Bot não autorizado.');
      console.log(`🚫 Bot expulso: ${member.user.tag}`);
      log(client, member.guild, 'bot_expulso', {
        acao: 'Bot Não Autorizado Expulso',
        alvo: `${member.user.tag} (\`${member.user.id}\`)`,
      });
      const logCh = member.guild.channels.cache.find(
        c => c.isTextBased() && c.permissionsFor(member.guild.members.me)?.has('SendMessages')
      );
      logCh?.send({ embeds: [{ color: 0xFF0000, title: '🚫 Bot Não Autorizado Expulso',
        description: `**${member.user.tag}** (\`${member.user.id}\`) foi expulso.\nUse \`/menu\` para autorizar bots.`,
        timestamp: new Date().toISOString() }] }).catch(() => {});
    } catch (err) { console.error('Erro ao expulsar bot:', err.message); }
    return;
  }

  // Membro humano — boas-vindas
  await recepcionarMembro(member);

  // Envia anúncio DM ativo (se houver)
  const dmAtivo = anuncioSub.getAnuncioDMAtivo();
  if (dmAtivo) {
    try { await member.send({ embeds: [dmAtivo.embed] }); } catch { /* DMs fechadas */ }
  }
  // Atualiza canal de contagem
  const { atualizarMembros } = require('./menu/canalStatusHandler');
  atualizarMembros(member.guild);
  log(client, member.guild, 'membro_entrou', {
    acao: 'Membro Entrou',
    alvo: `${member.user.tag} (<@${member.user.id}>)`,
    detalhes: `Conta criada: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
  });
});

// ─── Membro saiu ───────────────────────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  if (member.guild.id !== GUILD_ID) return;
  if (member.user.bot) return;
  await despedirMembro(member);
  const { atualizarMembros: atuMem } = require('./menu/canalStatusHandler');
  atuMem(member.guild);
  log(client, member.guild, 'membro_saiu', {
    acao: 'Membro Saiu',
    alvo: `${member.user.tag} (\`${member.user.id}\`)`,
  });
});

// ─── Interações ────────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── /menu ──────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'menu') {
    if (!temCargo(interaction)) return semPermissao(interaction);
    return enviarMenu(interaction);
  }

  // ── Botões ─────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {

    // Painel principal
    if (interaction.customId.startsWith('menu_')) {
      if (!temCargo(interaction)) return semPermissao(interaction);
      switch (interaction.customId) {
        case 'menu_anuncio':          return anuncioSub.enviarSubMenu(interaction);
        case 'menu_editar_anuncio':   return anuncio.abrirModalEdicao(interaction);
        case 'menu_sorteio':          return sub.enviarSubMenu(interaction);   // ← abre sub-menu
        case 'menu_trancar':          return abrirModalTrancar(interaction);
        case 'menu_abrir':            return abrirModalAbrir(interaction);
        case 'menu_bot_autorizar':    return bot.abrirModalAutorizar(interaction);
        case 'menu_bot_desautorizar': return bot.abrirModalDesautorizar(interaction);
        case 'menu_bot_lista':        return bot.listar(interaction);
        case 'menu_usuario':          return usuario.abrirModal(interaction);
        case 'menu_stats':            return stats.mostrarStats(interaction);
      }
    }

    // Sub-menu do anúncio (an_ = anuncio)
    if (interaction.customId.startsWith('an_')) {
      if (!temCargo(interaction)) return semPermissao(interaction);
      switch (interaction.customId) {
        case 'an_canal':    return anuncioSub.modalCanal(interaction);
        case 'an_titulo':   return anuncioSub.modalTitulo(interaction);
        case 'an_conteudo': return anuncioSub.modalConteudo(interaction);
        case 'an_imagem':   return anuncioSub.modalImagem(interaction);
        case 'an_botoes':   return anuncioSub.modalBotoes(interaction);
        case 'an_botao1':   return anuncioSub.modalBotao(interaction, 1);
        case 'an_botao2':   return anuncioSub.modalBotao(interaction, 2);
        case 'an_botao3':   return anuncioSub.modalBotao(interaction, 3);
        case 'an_botao4':   return anuncioSub.modalBotao(interaction, 4);
        case 'an_botao5':   return anuncioSub.modalBotao(interaction, 5);
        case 'an_publicar': return anuncioSub.publicar(interaction);
        case 'an_dm':           return anuncioSub.enviarDM(interaction);
        case 'an_dm_desativar': return anuncioSub.desativarDM(interaction);
        case 'an_cancelar': return anuncioSub.cancelar(interaction);
      }
    }

    // Sub-menu do sorteio (ss_ = sorteio sub)
    if (interaction.customId.startsWith('ss_')) {
      if (!temCargo(interaction)) return semPermissao(interaction);
      switch (interaction.customId) {
        case 'ss_titulo':    return sub.modalTitulo(interaction);
        case 'ss_imagem':    return sub.modalImagem(interaction);
        case 'ss_premios':   return sub.modalPremios(interaction);
        case 'ss_duracao':   return sub.modalDuracao(interaction);
        case 'ss_criterios': return sub.modalCriterios(interaction);
        case 'ss_publicar':  return sub.publicar(interaction, client);
        case 'ss_finalizar': return sub.finalizarAtivo(interaction, client);
        case 'ss_cancelar':  return sub.cancelar(interaction);
      }
    }

    // Botão destravar canal (qualquer membro com cargo autorizado)
    if (interaction.customId.startsWith('canal_destravar_')) {
      return destravaBotao(interaction);
    }

    // Botão avaliar — qualquer membro pode clicar
    if (interaction.customId === 'aval_abrir_modal') {
      return avaliacao.abrirModal(interaction);
    }

    // Botões de moderação de avaliação
    if (interaction.customId.startsWith('aval_aprovar_')) return avaliacao.aprovar(interaction);
    if (interaction.customId.startsWith('aval_negar_'))   return avaliacao.negar(interaction);
    if (interaction.customId.startsWith('aval_bloquear_')) return avaliacao.bloquear(interaction);

    // Botão participar no sorteio (qualquer membro)
    if (interaction.customId.startsWith('sorteio_participar_')) {
      return sorteioParticipar(interaction);
    }

    // Botão 🌐 Traduzir (qualquer membro)
    if (interaction.customId.startsWith('traduzir_abrir_')) {
      return abrirMenuIdiomas(interaction, interaction.customId.replace('traduzir_abrir_', ''));
    }
  }

  // ── Select Menu ────────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('traduzir_idioma_')) {
      return processarTraducao(interaction);
    }
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {

    // Modals do sub-menu de anúncio
    if (interaction.customId.startsWith('anm_')) {
      if (!temCargo(interaction)) return semPermissao(interaction);
      switch (interaction.customId) {
        case 'anm_canal':    return anuncioSub.processarCanal(interaction);
        case 'anm_titulo':   return anuncioSub.processarTitulo(interaction);
        case 'anm_conteudo': return anuncioSub.processarConteudo(interaction);
        case 'anm_imagem':   return anuncioSub.processarImagem(interaction);
        case 'anm_botao1':   return anuncioSub.processarBotao(interaction, 1);
        case 'anm_botao2':   return anuncioSub.processarBotao(interaction, 2);
        case 'anm_botao3':   return anuncioSub.processarBotao(interaction, 3);
        case 'anm_botao4':   return anuncioSub.processarBotao(interaction, 4);
        case 'anm_botao5':   return anuncioSub.processarBotao(interaction, 5);
      }
    }

    // Modals do sub-menu de sorteio (não exigem cargo na resposta pois o
    // botão que os abriu já verificou — mas re-verifica por segurança)
    if (interaction.customId.startsWith('sm_')) {
      if (!temCargo(interaction)) return semPermissao(interaction);
      switch (interaction.customId) {
        case 'sm_titulo':    return sub.processarTitulo(interaction);
        case 'sm_imagem':    return sub.processarImagem(interaction);
        case 'sm_premios':   return sub.processarPremios(interaction);
        case 'sm_duracao':   return sub.processarDuracao(interaction);
        case 'sm_criterios': return sub.processarCriterios(interaction);
      }
    }

    // Modal de avaliação — qualquer membro, sem verificação de cargo
    if (interaction.customId === 'modal_avaliacao') {
      return avaliacao.processarModal(interaction);
    }

    // Demais modals do painel principal
    if (!temCargo(interaction)) return semPermissao(interaction);
    switch (interaction.customId) {
      case 'modal_anuncio':          return anuncio.processarModal(interaction);
      case 'modal_editar_anuncio':   return anuncio.processarEdicao(interaction);
      case 'modal_trancar':          return processarTrancar(interaction);
      case 'modal_abrir':            return processarAbrir(interaction);
      case 'modal_bot_autorizar':    return bot.processarAutorizar(interaction);
      case 'modal_bot_desautorizar': return bot.processarDesautorizar(interaction);
      case 'modal_usuario':          return usuario.processarModal(interaction);
    }
  }
});

// ─── Tratamento global de erros não capturados ────────────────────────────────
// (já registrado no topo do arquivo)

// ─── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN);
