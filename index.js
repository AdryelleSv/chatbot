const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const representantes = {
  adryelle: "558188695541@c.us",
};

const representantesIds = Object.values(representantes);
const cliente = new Client({ authStrategy: new LocalAuth() });

const activeChats = new Map(); // Cliente -> Representante ativo
const idleTimers = new Map(); // Gerencia timers de inatividade
const users = new Map(); // Armazena os nomes dos clientes
let restartAttempts = 0; // Número de tentativas de reinicialização
let textQrCode = undefined;
cliente.on("qr", (qr) => {
  textQrCode = qr
});

cliente.on("ready", () => {
  console.log("Bot está pronto!");
  restartAttempts = 0; // Reseta contagem de falhas após sucesso
});

//RESETA O TIMER DE OCIOSIDADE
const resetIdleTimer = (chatId) => {
  if (activeChats.has(chatId)) return; 
  if (idleTimers.has(chatId)) clearTimeout(idleTimers.get(chatId)); //PERGUNTA SE AINDA ESTA ATIVO
  const firstTimer = setTimeout(() => {
    if (activeChats.has(chatId)) return;
    cliente.sendMessage(
      chatId,
      'Você está inativo há algum tempo. Deseja continuar o atendimento? Responda "Sim" em até 2 minutos para não encerrar.'
    );

    const secondTimer = setTimeout(() => {
      if (activeChats.has(chatId)) return;

      users.delete(chatId);
      cliente.sendMessage(
        chatId,
        "Conversa encerrada por inatividade. Se precisar de ajuda, é só me chamar! 😊"
      );
    }, 120000);

  idleTimers.set(chatId, secondTimer);
  }, 110000); 

  idleTimers.set(chatId, firstTimer);
};

cliente.on("message", async (message) => {
  const chatId = message.from;
  resetIdleTimer(chatId);

  if (!users.has(chatId)) {
    const nome = message.body.trim();
    if (nome.length < 3) {
      client.sendMessage(chatId, 'Olá! 😊 Como gostaria de ser chamado? (Mínimo de 3 letras)');
      return;
    }
    users.set(chatId, nome);
    cliente.sendMessage(chatId, `Olá ${nome}, tudo bem? 😊
      \n
      \nBem-vindo(a) à Central de Relacionamentos da Lins Fios. Escolha uma opção:
      \n
      \n1️⃣ - 📖 Catálogo Fios
      \n2️⃣ - 📖 Catálogo Linhas
      \n3️⃣ - 👥 Falar com um representante
      \n4️⃣ - 👩‍💻 Financeiro / Solicitação de Boletos
      \n
      \nPor favor, digite o número correspondente à sua escolha.`);
    return;
  }

  if (activeChats.has(chatId)) {
    const repId = activeChats.get(chatId);

    // Verifica se o cliente deseja encerrar o atendimento
    if (message.body.trim().toLowerCase() === "#sair") {
      activeChats.delete(chatId);
      cliente.sendMessage(
        chatId,
        "Atendimento encerrado. Se precisar de ajuda, estou por aqui! 😊"
      );
      cliente.sendMessage(
        repId,
        `O cliente ${users.get(chatId)} encerrou o atendimento.`
      );
      return;
    }

    // Cliente -> Representante
    if (!representantesIds.includes(chatId)) {
      cliente.sendMessage(repId, `Cliente (${users.get(chatId)}): ${message.body}`);
    } else {
      const clientId = [...activeChats.entries()].find(([_, v]) => v === chatId)?.[0];
      if (clientId) {
        cliente.sendMessage(clientId, `Representante: ${message.body}`);
      }
    }
    return;
  }

  switch (message.body.trim()) {
          case '1':
              try {
                  const fiosPdf = await MessageMedia.fromFilePath('./pdfs/Catalogo_Digital_Fios.pdf');
                  cliente.sendMessage(chatId, fiosPdf, { caption: '📄 Aqui está o catálogo digital de fios.' });
              } catch (err) {
                  cliente.sendMessage(chatId, "Erro ao carregar o catálogo de fios. Tente novamente mais tarde.");
                  console.error("Erro ao carregar o arquivo PDF de fios:", err);
              }
              break;
  
          case '2':
              try {
                  const linhasPdf = await MessageMedia.fromFilePath('./pdfs/Catalogo_Digital_Linhas.pdf');
                  cliente.sendMessage(chatId, linhasPdf, { caption: '📄 Aqui está o catálogo digital de linhas.' });
              } catch (err) {
                  cliente.sendMessage(chatId, "Erro ao carregar o catálogo de linhas. Tente novamente mais tarde.");
                  console.error("Erro ao carregar o arquivo PDF de linhas:", err);
              }
              break;
  
          case '3':
              cliente.sendMessage(chatId, "Aguarde enquanto conectamos você com um representante...");
              setTimeout(() => {
                  activeChats.set(chatId, representantes.adryelle);
                  cliente.sendMessage(chatId, `Você será atendido por nosso representante. Para encerrar, digite "#sair".`);
                  cliente.sendMessage(representantes.adryelle, `Novo atendimento iniciado por ${users.get(chatId)} (${chatId}).`);
              }, 2000);
              break;
  
          case '4':
              cliente.sendMessage(chatId, `Você pode falar com o setor financeiro diretamente pelo link:\n\nhttps://wa.me/558198492778`);
              break;
  
          default:
              cliente.sendMessage(chatId, `Desculpe, não entendi. Escolha uma das opções`);
      }
  });
  

cliente.on("error", (error) => {
  console.error("Erro detectado:", error);
  if (restartAttempts < 3) {
    restartAttempts++;
    console.log(`Tentando reiniciar... (Tentativa ${restartAttempts}/3)`);
    setTimeout(() => cliente.initialize(), 5000);
  } else {
    console.log(
      "Falha ao reiniciar após múltiplas tentativas. Verifique o erro acima."
    );
  }
});

cliente.on("disconnected", (reason) => {
  console.log(`Bot desconectado: ${reason}`);
  console.log("Tentando reiniciar...");
  cliente.initialize();
});

cliente.initialize().catch((error) => {
  console.error("Erro ao inicializar o cliente:", error);
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