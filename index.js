require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const StickerPack = require('./models/StickerPack');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

let bot;

connectDB();

if (RENDER_URL) {
  bot = new TelegramBot(TOKEN, { webHook: { port: PORT } });
  bot.setWebHook(`${RENDER_URL}/bot${TOKEN}`).then(() => {
    console.log(`✅ Webhook set: ${RENDER_URL}/bot${TOKEN}`);
  });
} else {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Polling mode (local)');
}

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `👋 Send me a sticker pack link:\n\nhttps://t.me/addstickers/PackName\n\nI will send you a .txt file with all sticker IDs.`
  );
});

// Handle any message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  // Match sticker pack link
  const match = text.match(/https?:\/\/t\.me\/addstickers\/([A-Za-z0-9_]+)/i);
  if (!match) return;

  const packName = match[1];

  const processing = await bot.sendMessage(chatId, `⏳ Processing pack: ${packName}...`);

  try {
    // Check DB cache first
    let pack = await StickerPack.findOne({ packName });
    let fileIds;

    if (pack) {
      fileIds = pack.stickers;
    } else {
      // Fetch from Telegram
      const stickerSet = await bot.getStickerSet(packName);
      fileIds = stickerSet.stickers.map(s => s.file_id);

      // Save to MongoDB
      pack = new StickerPack({
        packName,
        title: stickerSet.title,
        stickers: fileIds
      });
      await pack.save();
    }

    // Write txt file
    const tmpPath = path.join('/tmp', `${packName}_stickers.txt`);
    const content = fileIds.join('\n');
    fs.writeFileSync(tmpPath, content, 'utf-8');

    // Delete the "Processing..." message
    await bot.deleteMessage(chatId, processing.message_id).catch(() => {});

    // Send the txt file ONLY
    await bot.sendDocument(chatId, tmpPath, {
      caption: `✅ ${packName} — ${fileIds.length} sticker IDs`,
    }, {
      filename: `${packName}_stickers.txt`,
      contentType: 'text/plain',
    });

    // Cleanup tmp file
    fs.unlinkSync(tmpPath);

  } catch (err) {
    await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
    bot.sendMessage(chatId, `❌ Error: ${err.message}\n\nCheck the pack name and make sure it's public.`);
  }
});

console.log('🤖 Bot started');
