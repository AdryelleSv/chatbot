const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const representatives = {
    junior: '558199663039@c.us',
    walquiria: '558198492778@c.us'
};
const representativeIds = Object.values(representatives);

const client = new Client({
    authStrategy: new LocalAuth()
});

const activeChats = new Map(); // Cliente -> Representante ativo
const idleTimers = new Map(); // Gerencia timers de inatividade
const users = new Map(); // Armazena os nomes dos clientes

client.on('qr', (qr) => {
    console.log('QR Code recebido, escaneie com o WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está pronto!');
});

// Função para resetar o timer de inatividade
const resetIdleTimer = (chatId) => {
    if (idleTimers.has(chatId)) clearTimeout(idleTimers.get(chatId));

    const firstTimer = setTimeout(() => {
        if (activeChats.has(chatId)) {
            client.sendMessage(chatId, 'Você está inativo há algum tempo. Deseja continuar o atendimento? Responda "Sim" em até 2 minutos para não encerrar.');

            const secondTimer = setTimeout(() => {
                if (activeChats.has(chatId)) {
                    activeChats.delete(chatId);
                    client.sendMessage(chatId, 'Conversa encerrada por inatividade. Se precisar de ajuda, é só me chamar! 😊');
                }
            }, 120000); // 2 minutos

            idleTimers.set(chatId, secondTimer);
        }
    }, 110000); // 1m50s

    idleTimers.set(chatId, firstTimer);
};

client.on('message', async (message) => {
    const chatId = message.from;
    resetIdleTimer(chatId);

    // Se o cliente ainda não forneceu um nome, pergunta primeiro
    if (!users.has(chatId)) {
        if (message.body.trim().length < 3) {
            client.sendMessage(chatId, 'Olá! 😊 Como gostaria de ser chamado?');
            return;
        }
        users.set(chatId, message.body.trim()); // Armazena o nome informado

        // Após armazenar o nome, envia o menu personalizado
        client.sendMessage(chatId, `Olá ${message.body}, tudo bem? 😊
            \nBem-vindo(a) à Central de Relacionamentos da Lins Fios. Escolha uma opção:
            \n1️⃣ - 📖 Catálogo Fios
            \n2️⃣ - 📖 Catálogo Linhas
            \n3️⃣ - 👥 Falar com um representante
            \n4️⃣ - 👩‍💻 Financeiro / Solicitação de Boletos
            \nPor favor, digite o número correspondente à sua escolha.`);
        return;
    }
    // Se um representante estiver atendendo, o chatbot apenas repassa as mensagens
    if (activeChats.has(chatId)) {
        const repId = activeChats.get(chatId);

        // Cliente mandando mensagem → Repassa para o representante
        if (!representativeIds.includes(chatId)) {
            client.sendMessage(repId, `Cliente (${users.get(chatId)}): ${message.body}`);
        }
        // Representante mandando mensagem → Repassa para o cliente
        else {
            const clientId = [...activeChats.entries()].find(([_, v]) => v === chatId)?.[0];
            if (clientId) {
                client.sendMessage(clientId, `Representante: ${message.body}`);
            }
        }
        return;
    }

    // Processamento do menu principal
    switch (message.body.toLowerCase()) {
        case '1':
            const fiosPdf = MessageMedia.fromFilePath('./pdfs/Catalogo_Digital_Fios.pdf');
            client.sendMessage(chatId, fiosPdf, { caption: '📄 Aqui está o catálogo digital de fios.' });
            break;

        case '2':
            const linhasPdf = MessageMedia.fromFilePath('./pdfs/Catalogo_Digital_Linhas.pdf');
            client.sendMessage(chatId, linhasPdf, { caption: '📄 Aqui está o catálogo digital de linhas.' });
            break;

        case '3':
            activeChats.set(chatId, representatives.junior);
            message.reply(`Você será atendido pelo nosso representante. Caso prefira *Para encerrar, digite "#sair"*.`);
            client.sendMessage(representatives.junior, `Novo atendimento iniciado por ${users.get(chatId)} (${chatId}).`);
            break;

        case '4':
            message.reply(`Você pode falar com o setor financeiro diretamente pelo link:\n\nhttps://wa.me/558198492778`);
            break;

        default:
            message.reply(`Desculpe, não entendi. Escolha uma das opções abaixo:\n\n1️⃣ - 📖 Catálogo Fios\n2️⃣ - 📖 Catálogo Linhas\n3️⃣ - 👥 Falar com um representante\n4️⃣ - 👩‍💻 Financeiro / Solicitação de Boletos\n\nDigite apenas o número da opção desejada.`);
    }
});

client.on('error', (error) => console.error('Erro detectado:', error));

client.on('disconnected', (reason) => {
    console.log(`Bot desconectado: ${reason}`);
    console.log('Tentando reiniciar...');
    client.initialize();
});

client.initialize().catch((error) => {
    console.error('Erro ao inicializar o cliente:', error);
    setTimeout(() => client.initialize(), 5000);
});
