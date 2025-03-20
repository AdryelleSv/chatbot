const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const app = express();
const port = 3000;

const representantes = {
    junior: '558199663039@c.us',
    walquiria: '558198492778@c.us'
};
const representantesIds = Object.values(representantes);

const cliente = new Client({ authStrategy: new LocalAuth() });

const activeChats = new Map(); // Cliente -> Representante ativo
const idleTimers = new Map(); // Gerencia timers de inatividade
const users = new Map(); // Armazena os nomes dos clientes
let restartAttempts = 0; // Número de tentativas de reinicialização

app.use(express.static('public'));

app.get('/qrcode', (req, res) => {
    cliente.on('qr', (qr) => {
        QRCode.toDataURL(qr, (err, url) => {
            if (err) {
                res.status(500).send('Erro ao gerar QR Code');
            } else {
                res.json({ qr: url });
            }
        });
    });
    app.get('/qrcode', (req, res) => {
        res.sendFile(__dirname + '/index.html');
    });

    cliente.on('ready', () => {
        console.log('Bot está pronto!');
        restartAttempts = 0;
    });
    cliente.initialize();
});

// Função para resetar o timer de inatividade
const resetIdleTimer = (chatId) => {
    if (activeChats.has(chatId)) return;

    if (idleTimers.has(chatId)) clearTimeout(idleTimers.get(chatId));

    const firstTimer = setTimeout(() => {
        if (activeChats.has(chatId)) return;

        cliente.sendMessage(chatId, 'Você está inativo há algum tempo. Deseja continuar o atendimento? Responda "Sim" em até 2 minutos para não encerrar.');

        const secondTimer = setTimeout(() => {
            if (activeChats.has(chatId)) return;

            users.delete(chatId);
            cliente.sendMessage(chatId, 'Conversa encerrada por inatividade. Se precisar de ajuda, é só me chamar! 😊');
        }, 120000);
        idleTimers.set(chatId, secondTimer);
    }, 110000); //
    idleTimers.set(chatId, firstTimer);
};

cliente.on('message', async (message) => {
    const chatId = message.from;
    resetIdleTimer(chatId);

    if (!users.has(chatId)) {
        if (message.body.trim().length < 3) {
            cliente.sendMessage(chatId, 'Olá! 😊 Como gostaria de ser chamado?');
            return;
        }
        users.set(chatId, message.body.trim());
        cliente.sendMessage(chatId, `Olá ${message.body}, tudo bem? 😊\n\nBem-vindo(a) à Central de Relacionamentos da Lins Fios. Escolha uma opção:\n\n1️⃣ - 📖 Catálogo Fios\n2️⃣ - 📖 Catálogo Linhas\n3️⃣ - 👥 Falar com um representante\n4️⃣ - 👩‍💻 Financeiro / Solicitação de Boletos\n\nPor favor, digite o número correspondente à sua escolha.`);
        return;
    }

    switch (message.body.toLowerCase()) {
        case '1':
            try {
                const fiosPdf = await MessageMedia.fromFilePath('./pdfs/Catalogo_Digital_Fios.pdf');
                await cliente.sendMessage(chatId, fiosPdf, { caption: '📄 Aqui está o catálogo digital de fios.' });
            } catch (erro) {
                cliente.sendMessage(chatId, "Erro ao carregar o catálogo de fios. Tente novamente mais tarde.");
                console.error("Erro ao carregar o arquivo PDF de fios:", erro);
            }
            break;

        case '2':
            try {
                const linhasPdf = await MessageMedia.fromFilePath('./pdfs/Catalogo_Digital_Linhas.pdf');
                await cliente.sendMessage(chatId, linhasPdf, { caption: '📄 Aqui está o catálogo digital de linhas.' });
            } catch (erro) {
                cliente.sendMessage(chatId, "Erro ao carregar o catálogo de linhas. Tente novamente mais tarde.");
                console.error("Erro ao carregar o arquivo PDF de linhas:", erro);
            }
            break;

        case '3':
            const representanteDisponivel = representantesIds[0];
            activeChats.set(chatId, representanteDisponivel);
            message.reply(`Você será atendido pelo nosso representante. Caso prefira *Para encerrar, digite "#sair"*.`);
            cliente.sendMessage(representanteDisponivel, `Novo atendimento iniciado por ${users.get(chatId)} (${chatId}).`);
            break;
        case '4':
            message.reply(`Você pode falar com o setor financeiro diretamente pelo link:\n\nhttps://wa.me/558198492778`);
            break;
        default:
            message.reply(`Desculpe, não entendi. Escolha uma opção valida`);
    }
});

cliente.on('error', (error) => {
    console.error('Erro detectado:', error);
    if (restartAttempts < 3) {
        restartAttempts++;
        console.log(`Tentando reiniciar... (Tentativa ${restartAttempts}/3)`);
        setTimeout(() => cliente.initialize(), 5000);
    } else {
        console.log("Falha ao reiniciar após múltiplas tentativas. Verifique o erro acima.");
    }
});

cliente.on('disconnected', (reason) => {
    console.log(`Bot desconectado: ${reason}`);
    console.log('Tentando reiniciar...');
    cliente.initialize();
});
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

cliente.initialize().catch((error) => {
    console.error('Erro ao inicializar o cliente:', error);
});
