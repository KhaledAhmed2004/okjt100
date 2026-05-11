"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const MosqueSchema = new mongoose_1.Schema({
    mosqueName: { type: String, required: true },
    address: { type: String, required: true },
    area: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    website: { type: String },
    location: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
    },
    prayerTimes: {
        fajr: { type: String, required: true },
        dhuhr: { type: String, required: true },
        asr: { type: String, required: true },
        maghrib: { type: String, required: true },
        isha: { type: String, required: true },
        jummah: { type: String },
    },
}, {
    timestamps: true,
});
// Indexes for search and filtering
MosqueSchema.index({ mosqueName: 'text', area: 'text', address: 'text' });
MosqueSchema.index({ area: 1 });
const Mosque = (0, mongoose_1.model)('Mosque', MosqueSchema);
exports.default = Mosque;
