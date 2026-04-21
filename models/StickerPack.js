const mongoose = require('mongoose');

const StickerPackSchema = new mongoose.Schema({
  packName: { type: String, required: true, unique: true },
  title:    { type: String, default: '' },
  stickers: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('StickerPack', StickerPackSchema);
