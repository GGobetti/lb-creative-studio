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
    const client = new telegram_1.TelegramClient(stringSession, apiId, apiHash, {});
    await client.connect();
    await client.getDialogs();
    const targetGroupsRaw = process.env.TARGET_GROUPS || "";
    const targetGroups = targetGroupsRaw.split(",").map(g => g.trim()).filter(Boolean);
    const dialogs = await client.getDialogs();
    const d = dialogs.find(d => d.title && d.title.toLowerCase().includes("creative"));
    if (!d) {
        console.error("Group not found in dialogs");
        await client.disconnect();
        return;
    }
    const chat = d.entity;
    const chatTitle = d.title || "";
    const chatUsername = d.entity?.username || "";
    const chatIdStr = String(d.id);
    console.log("--- Group Details ---");
    console.log(`Title: "${chatTitle}"`);
    console.log(`Username: "${chatUsername}"`);
    console.log(`d.id (Dialog ID): "${d.id}"`);
    console.log(`chat.id (Entity ID): "${chat.id}"`);
    const me = await client.getMe();
    console.log(`Userbot Account ID: "${me.id}"`);
    const messages = await client.getMessages(chat, { limit: 10 });
    console.log("\n--- Simulating Scraper Event Handler for Messages ---");
    for (const message of messages) {
        // 1. Check if from target group
        const isFromTargetGroup = targetGroups.some((group) => group.toLowerCase() === chatTitle.toLowerCase() ||
            group.toLowerCase() === chatUsername.toLowerCase() ||
            group === String(message.chatId));
        const senderId = message.senderId ? String(message.senderId) : "unknown";
        const isMe = senderId === String(me.id);
        console.log(`\n[Msg ID: ${message.id}] Date: ${new Date(message.date * 1000).toLocaleString("pt-BR")}`);
        console.log(`Sender ID: "${senderId}" | IsMe: ${isMe}`);
        console.log(`message.chatId: "${message.chatId}" (Type: ${typeof message.chatId})`);
        console.log(`String(message.chatId): "${String(message.chatId)}"`);
        console.log(`isFromTargetGroup: ${isFromTargetGroup}`);
        if (!isFromTargetGroup)
            continue;
        const isDoc = message.media && "document" in message.media;
        const isPhoto = !!(message.photo ||
            (message.media && ("photo" in message.media || message.media.className === "MessageMediaPhoto")));
        console.log(`isDoc: ${isDoc} | isPhoto: ${isPhoto}`);
        if (isDoc || isPhoto) {
            if (isDoc) {
                const doc = message.media.document;
                let fileName = "arquivo.stl";
                const attr = doc.attributes?.find((a) => "fileName" in a);
                if (attr)
                    fileName = attr.fileName;
                const isStl = fileName.endsWith(".stl") || (doc.mimeType && doc.mimeType.includes("stl"));
                const is3mf = fileName.endsWith(".3mf") || (doc.mimeType && doc.mimeType.includes("3mf"));
                const isCompressed = fileName.endsWith(".zip") || fileName.endsWith(".rar") || fileName.endsWith(".7z");
                console.log(`File Name: "${fileName}"`);
                console.log(`isStl: ${isStl} | is3mf: ${is3mf} | isCompressed: ${isCompressed}`);
                if (!isStl && !is3mf && !isCompressed) {
                    console.log("-> Rejected: not an STL, 3MF, or compressed file");
                }
                else {
                    console.log("-> MATCHED! Would process.");
                }
            }
            else {
                console.log("-> MATCHED as Photo! Would process.");
            }
        }
    }
    await client.disconnect();
}
main().catch(console.error);
