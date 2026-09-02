# 👑 Bot Mr — Chefe dos Bots

O bot chefe do servidor. Controla outros bots, faz anúncios, sorteios e gerencia canais.

---

## ⚡ Instalação

```bash
# 1. Instale as dependências
npm install

# 2. Copie o arquivo de exemplo e preencha com suas credenciais
copy .env.example .env

# 3. Inicie o bot
npm start
```

---

## 🔧 Configuração (.env)

| Variável    | Descrição                                      |
|-------------|------------------------------------------------|
| `TOKEN`     | Token do bot (Discord Developer Portal)        |
| `CLIENT_ID` | ID da aplicação (Application ID no portal)     |

---

## 🛡️ Permissões necessárias no servidor

- `Kick Members` — para expulsar bots não autorizados
- `Manage Channels` — para trancar/abrir canais
- `Manage Guild` — para buscar convites (critério de sorteio)
- `Send Messages` — para enviar anúncios e resultados
- `Connect` + `Speak` — para ficar no canal de voz

---

## 📋 Comandos

### `/anuncio`
Envia um embed de anúncio num canal escolhido.

| Opção       | Obrigatório | Descrição                        |
|-------------|-------------|----------------------------------|
| `canal`     | ✅          | Canal de destino                 |
| `titulo`    | ✅          | Título do embed                  |
| `assunto`   | ✅          | Texto principal                  |
| `imagem`    | ❌          | URL da imagem                    |
| `cor`       | ❌          | Cor em hex (ex: `#FF5733`)       |
| `rodape`    | ❌          | Texto do rodapé                  |

---

### `/sorteio criar`
Cria um sorteio com botão de participação e encerramento automático.

| Opção                | Obrigatório | Descrição                                        |
|----------------------|-------------|--------------------------------------------------|
| `canal`              | ✅          | Canal do sorteio                                 |
| `titulo`             | ✅          | Título                                           |
| `assunto`            | ✅          | Descrição / prêmio                               |
| `duracao`            | ✅          | Duração: `30m`, `1h`, `2h`, `1d`, `3d` etc.     |
| `imagem`             | ❌          | URL da imagem                                    |
| `cargo_obrigatorio`  | ❌          | Critério: precisa ter este cargo                 |
| `convites_minimos`   | ❌          | Critério: precisa ter convidado X pessoas        |
| `vencedores`         | ❌          | Quantidade de vencedores (padrão: 1)             |

### `/sorteio encerrar`
Encerra um sorteio antecipadamente pelo ID da mensagem.

### `/sorteio resorteio`
Faz um novo sorteio com os participantes de um sorteio já encerrado.

---

### `/canal trancar`
Tranca um canal (bloqueia @everyone de enviar mensagens).

### `/canal abrir`
Reabre um canal trancado.

Ambos aceitam `canal` (opcional, padrão = canal atual) e `motivo`.

---

### `/bot autorizar`
Adiciona um bot à lista de permitidos pelo ID.

### `/bot desautorizar`
Remove um bot da lista.

### `/bot lista`
Mostra todos os bots autorizados.

> Apenas quem tem o cargo Chefe pode usar esses comandos.

---

## 🤖 Anti-Bot

Quando qualquer bot entra no servidor sem estar na lista de autorizados, ele é expulso automaticamente.
Para autorizar use `/bot autorizar id:ID_DO_BOT`.

---

## 🎙️ Canal de Voz

O bot entra automaticamente no canal de voz `1522518246694191284` ao ligar e reconecta sozinho se cair.
