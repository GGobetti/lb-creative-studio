"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const apiHash = process.env.TELEGRAM_API_HASH || "";
const sessionString = process.env.TELEGRAM_SESSION || "";
const stringSession = new sessions_1.StringSession(sessionString);
async function main() {
    console.log("Connecting to Telegram...");
    const client = new telegram_1.TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    await client.connect();
    console.log("Connected successfully!");
    console.log("Fetching dialogs...");
    const dialogs = await client.getDialogs();
    console.log(`Found ${dialogs.length} dialogs.`);
    console.log("--- SEARCHING DIALOGS FOR 'FREXCURA' / 'FRESCURA' / 'STL' ---");
    let targetChat = null;
    for (const d of dialogs) {
        const title = d.title || "";
        const id = String(d.id);
        const username = d.entity?.username || "";
        const isMatch = title.toLowerCase().includes("fre") ||
            title.toLowerCase().includes("stl") ||
            username.toLowerCase().includes("fre") ||
            username.toLowerCase().includes("stl");
        if (isMatch) {
            console.log(`Matched Dialog: Title="${title}" | ID=${id} | Username=@${username} | UnreadCount=${d.unreadCount}`);
        }
        if (title.toLowerCase().includes("frexcura") || title.toLowerCase().includes("frescura")) {
            targetChat = d.entity;
        }
    }
    if (targetChat) {
        console.log(`\nFound target chat. Fetching latest 10 messages...`);
        const messages = await client.getMessages(targetChat, { limit: 10 });
        for (const msg of messages) {
            let mediaType = "none";
            let fileName = "";
            if (msg.media) {
                mediaType = msg.media.className || "unknown";
                if ('document' in msg.media) {
                    const doc = msg.media.document;
                    const attr = doc.attributes?.find((a) => 'fileName' in a);
                    if (attr)
                        fileName = attr.fileName;
                }
            }
            const dateStr = new Date(msg.date * 1000).toLocaleString("pt-BR");
            console.log(`[ID: ${msg.id}] Date: ${dateStr} | Text: "${msg.message || ""}" | Media: ${mediaType} | File: ${fileName}`);
        }
    }
    else {
        console.log("\nCould not find any dialog matching 'frexcura' or 'frescura' to fetch message history.");
    }
    await client.disconnect();
}
main().catch(console.error);
