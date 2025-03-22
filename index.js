const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const representantes = {
  adryelle: "558199663039@c.us",
};

const representantesIds = Object.values(representantes);
const client = new Client({ authStrategy: new LocalAuth() });

const activeChats = new Map(); // client -> Representante ativo
const idleTimers = new Map(); // Gerencia timers de inatividade
const users = new Map(); // Armazena os nomes dos clients
let restartAttempts = 1; // Número de tentativas de reinicialização
let textQrCode = undefined;
client.on("qr", (qr) => {
  textQrCode = qr
});

client.on("ready", () => {
  console.log("Bot está pronto!");
  restartAttempts = 0; // Reseta contagem de falhas após sucesso
});

//RESETA O TIMER DE OCIOSIDADE
const resetIdleTimer = (chatId) => {
  if (activeChats.has(chatId)) return; //checa se esta ativo no timing
  if (idleTimers.has(chatId)) clearTimeout(idleTimers.get(chatId)); //PERGUNTA SE AINDA ESTA ATIVO
  const firstTimer = setTimeout(() => {
    if (activeChats.has(chatId)) return;
    client.sendMessage(
      chatId,
      'Você está inativo há algum tempo. Deseja continuar o atendimento? Responda "Sim" em até 2 minutos para não encerrar.'
    );

    const secondTimer = setTimeout(() => {
      if (activeChats.has(chatId)) return;

      users.delete(chatId);
      client.sendMessage(
        chatId,
        "Conversa encerrada por inatividade. Se precisar de ajuda, é só me chamar! 😊"
      );
    }, 120000);

    idleTimers.set(chatId, secondTimer);
  }, 110000);

  idleTimers.set(chatId, firstTimer);
};

client.on("message", async (message) => {
  const chatId = message.from;
  resetIdleTimer(chatId);

  if (activeChats.has(chatId)) {
    const repId = activeChats.get(chatId); // ID do representante vinculado ao cliente

    if (!message.body.trim().match(/^[a-zA-ZÀ-ÿ\s]{3,}$/)) {
      client.sendMessage(chatId, 'Olá! 😊 Antes de começarmos, como gostaria de ser chamado? (Apenas letras, mínimo 3 caracteres)');
      return;
    }
    users.set(chatId, message.body.trim());
    client.sendMessage(chatId, `Olá ${message.body.trim()}, tudo bem? 😊\nEscolha uma opção:\n\n1️⃣ - 📖 Catálogo Fios\n2️⃣ - 📖 Catálogo Linhas\n3️⃣ - 👥 Falar com um representante\n4️⃣ - 👩‍💻 Financeiro / Solicitação de Boletos`);
    return;
  }

  if (activeChats.has(chatId)) {
    const repId = activeChats.get(chatId);

    // Verifica se o client deseja encerrar o atendimento
    if (message.body.trim().toLowerCase() === "#sair") {
      activeChats.delete(chatId);
      client.sendMessage(
        chatId,
        "Atendimento encerrado. Se precisar de ajuda, estou por aqui! 😊"
      );
      client.sendMessage(
        repId,
        `O client ${users.get(chatId)} encerrou o atendimento.`
      );
      return;
    }

    // client -> Representante
    if (representantesIds.includes(chatId)) {
      client.sendMessage(repId, `client (${users.get(chatId)}): ${message.body}`);
    } else {
      const clientId = [...activeChats.entries()].find(([_, v]) => v === chatId)?.[0];
      if (clientId) {
        if (clientId) {
          console.log(`🔄 Enviando mensagem do representante (${chatId}) para o cliente (${clientId})`);
          client.sendMessage(clientId, `📩 Representante: ${message.body}`);
        } else {
          console.log(`⚠️ Nenhum cliente ativo vinculado ao representante ${chatId}`);
        }
      }
      else {
        // Cliente enviando mensagem para o representante
        console.log(`🔄 Cliente (${chatId}) enviando para representante (${repId})`);
        client.sendMessage(repId, `Cliente (${users.get(chatId)}): ${message.body}`);
      }
      return;
    }
  }

  switch (message.body.trim()) {
    case '1':
      try {
        const fiosPdf = await MessageMedia.fromFilePath(path.join(__dirname, "public", "Catalogo_Digital_Fios.pdf"));
        client.sendMessage(chatId, fiosPdf, { caption: '📄 Aqui está o catálogo digital de fios.' });
      } catch (err) {
        client.sendMessage(chatId, "Erro ao carregar o catálogo de fios. Tente novamente mais tarde.");
        console.error("Erro ao carregar o arquivo PDF de fios:", err);
      }
      break;

    case '2':
      try {
        const linhasPdf = await MessageMedia.fromFilePath(path.join(__dirname, "public", "Catalogo_Digital_Linhas.pdf"));
        client.sendMessage(chatId, linhasPdf, { caption: '📄 Aqui está o catálogo digital de linhas.' });
      } catch (err) {
        client.sendMessage(chatId, "Erro ao carregar o catálogo de linhas. Tente novamente mais tarde.");
        console.error("Erro ao carregar o arquivo PDF de linhas:", err);
      }
      break;

    case '3':
      client.sendMessage(chatId, "Aguarde enquanto conectamos você com um representante...");
      setTimeout(() => {
        activeChats.set(chatId, representantes.adryelle);
        client.sendMessage(chatId, `Você será atendido por nosso representante. Para encerrar, digite "#sair".`);
        client.sendMessage(representantes.adryelle, `Novo atendimento iniciado por ${users.get(chatId)} (${chatId}).`);
      }, 2000);
      break;

    case '4':
      client.sendMessage(chatId, `Você pode falar com o setor financeiro diretamente pelo link:\n\nhttps://wa.me/558198492778`);
      break;

    default:
      client.sendMessage(chatId, `Desculpe, não entendi. Escolha uma das opções`);
  }
});


client.on("error", (error) => {
  console.error("Erro detectado:", error);
  if (restartAttempts < 3) {
    restartAttempts++;
    console.log(`Tentando reiniciar... (Tentativa ${restartAttempts}/3)`);
    setTimeout(() => client.initialize(), 5000);
  } else {
    console.log(
      "Falha ao reiniciar após múltiplas tentativas. Verifique o erro acima."
    );
  }
});

client.on("disconnected", (reason) => {
  console.log(`Bot desconectado: ${reason}`);
  console.log("Tentando reiniciar...");
  client.initialize();
});

client.initialize().catch((error) => {
  console.error("Erro ao inicializar o client:", error);
});

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

app.listen(3000, () => console.log("Servidor iniciado na porta 3000"));
app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "public", "index.html");

  // Lendo o arquivo HTML
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Erro ao carregar a página.");
    }
    if (textQrCode === undefined) {
      return res.send("o QrCode não esta pronto");
    }
    // Substituindo uma palavra (exemplo: trocando "Olá" por "Oi")
    const modifiedHtml = data.replace("QR_CODE_WHATSAPP", textQrCode);

    // Enviando o HTML modificado
    res.send(modifiedHtml);
  });
});