"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const uploads_1 = require("telegram/client/uploads");
const events_1 = require("telegram/events");
const supabase_js_1 = require("@supabase/supabase-js");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const readline_1 = __importDefault(require("readline"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const imageHash_1 = require("./imageHash");
dotenv_1.default.config();
// Inicializa Supabase Admin (para salvar no banco ignorando RLS)
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
// Configurações dinâmicas do scraper carregadas do Supabase
let targetGroupIds = new Set();
let targetGroupsConfigCache = [];
let groupPrinterTypes = new Map();
let sizeLimitBytes = 750 * 1024 * 1024; // Padrão 750 MB
let lastHeartbeatSuccess = Date.now();
let myId = null;
const apiId = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const apiHash = process.env.TELEGRAM_API_HASH || "";
const sessionString = process.env.TELEGRAM_SESSION || "";
const vaultChannelId = process.env.TELEGRAM_VAULT_CHANNEL_ID || "";
const proxyApiKey = process.env.TELEGRAM_PROXY_API_KEY || "";
const port = parseInt(process.env.PORT || "5000", 10);
const stringSession = new sessions_1.StringSession(sessionString);
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const askQuestion = (query) => {
    return new Promise((resolve) => rl.question(query, resolve));
};
const activeBuffers = new Map();
// Fila de Processamento Global para download/indexação sequencial
const queue = [];
let isProcessingQueue = false;
const cancelledJobs = new Set();
// Mapeamento em memória de progresso dos downloads (jobId -> percent)
const activeDownloads = new Map();
// Cache global de hashes de fotos: hash -> entityId ("stl:<id>" ou "job:<id>")
// Usado para detectar fotos que já pertencem a outro arquivo na sessão atual
const globalPhotoHashCache = new Map();
// Cache por entidade: entityId -> Set<hash> de fotos já conhecidas
// Evita re-download das fotos existentes de um mesmo STL quando ele aparece como duplicata
const entityPhotoHashCache = new Map();
// Caminho do arquivo de persistência do cache de hashes entre reinicializações
const PHOTO_HASH_CACHE_FILE = path_1.default.join(__dirname, "../.temp/photo_hash_cache.json");
// Timeout por tarefa na fila de processamento (10 minutos)
const QUEUE_TASK_TIMEOUT_MS = 10 * 60 * 1000;
// Promise com timeout — disponível em todo o módulo
function withTimeout(promise, ms, errorMsg) {
    let tid;
    const timeout = new Promise((_, reject) => {
        tid = setTimeout(() => reject(new Error(errorMsg)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(tid));
}
// fetch() com AbortController para evitar hangs em downloads de fotos
// Sem anotação de retorno explícita para evitar conflito com o tipo Response do express
async function fetchWithTimeout(url, ms = 30_000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal });
    }
    finally {
        clearTimeout(tid);
    }
}
// Carrega o cache de hashes de fotos do disco (sobrevive a reinicializações)
function loadHashCache() {
    try {
        if (fs_1.default.existsSync(PHOTO_HASH_CACHE_FILE)) {
            const data = JSON.parse(fs_1.default.readFileSync(PHOTO_HASH_CACHE_FILE, "utf-8"));
            for (const [hash, entityId] of Object.entries(data)) {
                globalPhotoHashCache.set(hash, entityId);
            }
            console.log(`[Cache] ${globalPhotoHashCache.size} hashes de fotos carregados do disco.`);
        }
    }
    catch (err) {
        console.warn("[Cache] Não foi possível carregar cache de hashes:", err.message);
    }
}
// Salva o cache de hashes em disco para sobreviver a reinicializações
function saveHashCache() {
    try {
        const dir = path_1.default.dirname(PHOTO_HASH_CACHE_FILE);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        const data = {};
        for (const [hash, entityId] of globalPhotoHashCache)
            data[hash] = entityId;
        fs_1.default.writeFileSync(PHOTO_HASH_CACHE_FILE, JSON.stringify(data));
        console.log(`[Cache] ${globalPhotoHashCache.size} hashes salvos em disco.`);
    }
    catch (err) {
        console.warn("[Cache] Não foi possível salvar cache de hashes:", err.message);
    }
}
// Watchdog: timestamp do último update/evento recebido do Telegram
let lastEventTimestamp = Date.now();
async function triggerQueue() {
    if (isProcessingQueue)
        return;
    isProcessingQueue = true;
    while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
            try {
                await withTimeout(task(), QUEUE_TASK_TIMEOUT_MS, `Tarefa da fila excedeu ${QUEUE_TASK_TIMEOUT_MS / 60000} minutos sem concluir`);
            }
            catch (e) {
                console.error("[Queue Processor] Erro ao processar tarefa da fila:", e.message);
            }
        }
    }
    isProcessingQueue = false;
}
// Constrói (e cacheia por sessão) o conjunto de hashes das fotos já vinculadas a uma entidade.
// entityId: "stl:<id>" ou "job:<id>"
async function buildEntityPhotoHashSet(entityId, photoUrls, tempDir) {
    if (entityPhotoHashCache.has(entityId))
        return entityPhotoHashCache.get(entityId);
    const hashSet = new Set();
    for (const url of photoUrls) {
        try {
            if (!fs_1.default.existsSync(tempDir))
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            const tempPath = path_1.default.join(tempDir, `hashbuild_${Date.now()}_${Math.random()}.jpg`);
            const res = await fetchWithTimeout(url, 30_000);
            if (!res.ok)
                continue;
            fs_1.default.writeFileSync(tempPath, Buffer.from(await res.arrayBuffer()));
            const h = await (0, imageHash_1.getPerceptualHash)(tempPath);
            try {
                fs_1.default.unlinkSync(tempPath);
            }
            catch { }
            hashSet.add(h);
            globalPhotoHashCache.set(h, entityId);
        }
        catch { }
    }
    entityPhotoHashCache.set(entityId, hashSet);
    return hashSet;
}
// Filtra candidatas a novas fotos removendo: banidas, duplicadas no mesmo arquivo,
// e fotos que já pertencem a outro arquivo na sessão atual (cross-file).
// Retorna apenas fotos genuinamente novas e atualiza os caches.
async function deduplicatePhotos(candidateUrls, photoHashByUrl, existingHashSet, entityId, bannedHashes, tempDir, logPrefix) {
    const result = [];
    for (const url of candidateUrls) {
        let hash = photoHashByUrl.get(url);
        if (!hash) {
            try {
                if (!fs_1.default.existsSync(tempDir))
                    fs_1.default.mkdirSync(tempDir, { recursive: true });
                const tempPath = path_1.default.join(tempDir, `hashcheck_${Date.now()}_${Math.random()}.jpg`);
                const res = await fetchWithTimeout(url, 30_000);
                if (!res.ok) {
                    result.push(url);
                    continue;
                }
                fs_1.default.writeFileSync(tempPath, Buffer.from(await res.arrayBuffer()));
                hash = await (0, imageHash_1.getPerceptualHash)(tempPath);
                try {
                    fs_1.default.unlinkSync(tempPath);
                }
                catch { }
                photoHashByUrl.set(url, hash);
            }
            catch {
                result.push(url);
                continue;
            }
        }
        // 1. Verifica blacklist
        const isBanned = bannedHashes.some(banned => (0, imageHash_1.hammingDistance)(hash, banned) <= 10);
        if (isBanned) {
            console.log(`${logPrefix} Foto BANIDA (propaganda), ignorando.`);
            continue;
        }
        // 2. Verifica duplicata dentro do mesmo arquivo (comparação visual por hash)
        let isDupSameFile = false;
        for (const h of existingHashSet) {
            if ((0, imageHash_1.hammingDistance)(hash, h) <= 10) {
                isDupSameFile = true;
                break;
            }
        }
        if (isDupSameFile) {
            console.log(`${logPrefix} Foto visualmente igual a uma já existente no mesmo arquivo, ignorando.`);
            continue;
        }
        // 3. Verifica cross-file: foto já pertence a outro arquivo nesta sessão
        let crossOwner = null;
        for (const [cachedHash, cachedEntityId] of globalPhotoHashCache) {
            if (cachedEntityId !== entityId && (0, imageHash_1.hammingDistance)(hash, cachedHash) <= 10) {
                crossOwner = cachedEntityId;
                break;
            }
        }
        if (crossOwner) {
            console.log(`${logPrefix} Foto parece pertencer a outro arquivo (${crossOwner}), ignorando cross-file.`);
            continue;
        }
        result.push(url);
        existingHashSet.add(hash);
        globalPhotoHashCache.set(hash, entityId);
    }
    return result;
}
// Wrapper para downloadMedia com limite de tempo por inatividade
async function downloadMediaWithTimeout(client, message, outputFile, timeoutMs = 60000, // 60 segundos padrão de inatividade
jobId, onProgress) {
    let lastProgress = Date.now();
    let completed = false;
    let lastReportedPercent = 0;
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            if (completed)
                return;
            if (Date.now() - lastProgress > timeoutMs) {
                clearInterval(checkInterval);
                completed = true;
                console.error(`[Scraper Timeout] Download de ${path_1.default.basename(outputFile)} travou sem progresso por mais de ${timeoutMs / 1000}s.`);
                try {
                    if (fs_1.default.existsSync(outputFile)) {
                        fs_1.default.unlinkSync(outputFile);
                    }
                }
                catch (e) { }
                reject(new Error(`Download timeout: no progress for ${timeoutMs / 1000} seconds`));
            }
        }, 5000);
        client.downloadMedia(message, {
            outputFile,
            progressCallback: (downloaded, total) => {
                lastProgress = Date.now();
                if (jobId && cancelledJobs.has(jobId)) {
                    throw new Error("Download cancelado pelo administrador");
                }
                if (total && Number(total) > 50 * 1024 * 1024) { // Update progress only for files > 50MB
                    const percent = Math.floor((Number(downloaded) / Number(total)) * 100);
                    if (percent >= lastReportedPercent + 5 || percent === 100) {
                        lastReportedPercent = percent;
                        if (jobId)
                            activeDownloads.set(jobId, percent);
                        if (onProgress)
                            onProgress(percent);
                    }
                }
            }
        }).then((res) => {
            clearInterval(checkInterval);
            if (jobId)
                activeDownloads.delete(jobId);
            completed = true;
            if (res && typeof res === "string") {
                resolve(res);
            }
            else {
                reject(new Error("Retorno inválido do download do Telegram."));
            }
        }).catch((err) => {
            clearInterval(checkInterval);
            if (jobId)
                activeDownloads.delete(jobId);
            completed = true;
            reject(err);
        });
    });
}
async function processBufferedEntry(client, key) {
    const buffer = activeBuffers.get(key);
    if (!buffer)
        return;
    activeBuffers.delete(key);
    // Sort messages by Telegram message ID to preserve chronological/sending order
    const sortedMessages = [...buffer.messages].sort((a, b) => a.message.id - b.message.id);
    const docs = sortedMessages.filter(m => m.type === "document");
    const photos = sortedMessages.filter(m => m.type === "photo");
    if (docs.length === 0) {
        console.log(`[Scraper Buffer] Processamento concluído para ${key}: nenhuma mídia STL/documento encontrada.`);
        return;
    }
    console.log(`[Scraper Buffer] Processando lote para ${key}: ${docs.length} documentos, ${photos.length} fotos.`);
    // Mapa local: url da foto -> hash perceptual (populado durante o upload das fotos)
    const photoHashByUrl = new Map();
    // 0. Fetch banned hashes to avoid uploading ads
    let bannedHashes = [];
    try {
        const { data: bannedData } = await supabase.from("telegram_banned_images").select("image_hash");
        if (bannedData) {
            bannedHashes = bannedData.map(r => r.image_hash);
        }
        console.log(`[Scraper Buffer] Blacklist carregada: ${bannedHashes.length} hashes banidos conhecidos.`);
    }
    catch (err) {
        console.error("[Scraper Buffer] Erro ao carregar blacklist do Supabase:", err);
    }
    // 1. Processar todas as fotos primeiro e fazer o upload para o Supabase Storage, mapeando ID da mensagem para URL pública
    const photoUrlsMap = new Map();
    for (let i = 0; i < photos.length; i++) {
        const photoMsg = photos[i].message;
        try {
            console.log(`[Scraper Buffer] Baixando foto ${i + 1}/${photos.length} (Msg ID: ${photoMsg.id}) do Telegram...`);
            const tempDir = path_1.default.join(__dirname, "../.temp");
            if (!fs_1.default.existsSync(tempDir)) {
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            }
            const tempPhotoPath = path_1.default.join(tempDir, `photo_${Date.now()}_${i}.jpg`);
            const downloadedPath = await downloadMediaWithTimeout(client, photoMsg, tempPhotoPath, 30000);
            if (downloadedPath && typeof downloadedPath === "string" && fs_1.default.existsSync(downloadedPath)) {
                // 1.5. Calculate perceptual hash and check blacklist
                let photoHash = null;
                try {
                    photoHash = await (0, imageHash_1.getPerceptualHash)(downloadedPath);
                    const isBanned = bannedHashes.some(banned => (0, imageHash_1.hammingDistance)(photoHash, banned) <= 10);
                    if (isBanned) {
                        console.log(`[Scraper Buffer] Foto Msg ID ${photoMsg.id} IGNORADA (Detectada como propaganda pela Blacklist, dHash: ${photoHash}).`);
                        try {
                            fs_1.default.unlinkSync(downloadedPath);
                        }
                        catch (e) { }
                        continue; // Pula o upload e não adiciona no photoUrlsMap
                    }
                }
                catch (hashErr) {
                    console.error(`[Scraper Buffer] Aviso: falha ao calcular hash da foto, prosseguindo com upload...`, hashErr);
                }
                console.log(`[Scraper Buffer] Enviando foto para o Supabase Storage...`);
                const fileBuffer = fs_1.default.readFileSync(downloadedPath);
                const fileName = path_1.default.basename(downloadedPath);
                const uploadPath = `telegram/${fileName}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from("portfolio")
                    .upload(uploadPath, fileBuffer, {
                    contentType: "image/jpeg",
                    cacheControl: "3600",
                    upsert: true
                });
                if (uploadError) {
                    console.error(`[Scraper Buffer] Erro ao enviar foto para o Supabase:`, uploadError.message);
                }
                else {
                    const { data: { publicUrl } } = supabase.storage
                        .from("portfolio")
                        .getPublicUrl(uploadPath);
                    photoUrlsMap.set(photoMsg.id, publicUrl);
                    if (photoHash)
                        photoHashByUrl.set(publicUrl, photoHash); // salva hash para dedup posterior
                    console.log(`[Scraper Buffer] Foto Msg ID ${photoMsg.id} disponível em: ${publicUrl}`);
                }
                // Limpar arquivo temporário de foto
                try {
                    fs_1.default.unlinkSync(downloadedPath);
                }
                catch (e) { }
            }
        }
        catch (err) {
            console.error(`[Scraper Buffer] Erro ao processar foto ${i + 1}:`, err.message);
        }
    }
    // 2. Mapeamento de proximidade: associar cada foto ao seu documento mais próximo
    const docPhotosMap = new Map(); // docMessageId -> URLs de fotos
    for (const photoItem of photos) {
        const photoMsg = photoItem.message;
        const photoUrl = photoUrlsMap.get(photoMsg.id);
        if (!photoUrl)
            continue;
        let closestDoc = null;
        let minDistance = Infinity;
        for (const docItem of docs) {
            const docMsg = docItem.message;
            const distance = Math.abs(docMsg.id - photoMsg.id);
            if (distance < minDistance) {
                minDistance = distance;
                closestDoc = docMsg;
            }
            else if (distance === minDistance && closestDoc) {
                // Se a distância for igual, preferir o documento postado APÓS a foto (photoMsg.id < docMsg.id)
                if (photoMsg.id < docMsg.id) {
                    closestDoc = docMsg;
                }
            }
        }
        if (closestDoc) {
            const currentList = docPhotosMap.get(closestDoc.id) || [];
            currentList.push(photoUrl);
            docPhotosMap.set(closestDoc.id, currentList);
        }
    }
    // 3. Processar cada documento STL/Comprimido
    for (const docItem of docs) {
        const docMsg = docItem.message;
        let jobId = null;
        const matchedPhotos = docPhotosMap.get(docMsg.id) || [];
        const updateJobStatus = async (status, errorMessage) => {
            if (!jobId)
                return;
            try {
                const { error } = await supabase
                    .from("telegram_scraper_jobs")
                    .update({
                    status,
                    error_message: errorMessage || null,
                    updated_at: new Date().toISOString(),
                })
                    .eq("id", jobId);
                if (error) {
                    console.error(`[Scraper Monitor] Erro ao atualizar job ${jobId} para ${status}:`, error.message);
                }
            }
            catch (ex) {
                console.error(`[Scraper Monitor] Exceção ao atualizar job ${jobId}:`, ex.message);
            }
        };
        let tempFilePath = null;
        try {
            const doc = docMsg.media.document;
            let fileName = "arquivo.stl";
            const attr = doc.attributes?.find((a) => "fileName" in a);
            if (attr)
                fileName = attr.fileName;
            const fileSize = Number(doc.size);
            // --- DUPLICATION CHECK E AGRUPAMENTO DE FOTOS ---
            try {
                const { data: existingStl } = await supabase
                    .from("telegram_indexed_stls")
                    .select("id, photos")
                    .eq("file_name", fileName)
                    .eq("file_size_bytes", fileSize)
                    .limit(1)
                    .maybeSingle();
                if (existingStl) {
                    console.log(`[Scraper Buffer] Arquivo ${fileName} (${fileSize} bytes) já indexado. Ignorando download/upload.`);
                    if (matchedPhotos.length > 0) {
                        const existingPhotos = existingStl.photos || [];
                        const entityId = `stl:${existingStl.id}`;
                        const tempDir = path_1.default.join(__dirname, "../.temp");
                        // Remove duplicatas exatas de URL como primeiro passo rápido
                        const urlDeduped = matchedPhotos.filter(p => !existingPhotos.includes(p));
                        if (urlDeduped.length > 0) {
                            // Constrói/recupera o conjunto de hashes das fotos já existentes neste STL
                            const existingHashSet = await buildEntityPhotoHashSet(entityId, existingPhotos, tempDir);
                            // Aplica dedup por hash: ban + mesmo arquivo + cross-file
                            const trulyNewPhotos = await deduplicatePhotos(urlDeduped, photoHashByUrl, existingHashSet, entityId, bannedHashes, tempDir, `[Photo Filter STL ${existingStl.id}]`);
                            if (trulyNewPhotos.length > 0) {
                                console.log(`[Scraper Buffer] Adicionando ${trulyNewPhotos.length} foto(s) genuinamente nova(s) ao registro existente ${existingStl.id}`);
                                const updatedPhotos = [...existingPhotos, ...trulyNewPhotos];
                                const thumbnail_url = updatedPhotos.length > 0 ? updatedPhotos[0] : null;
                                const updatePayload = { photos: updatedPhotos, has_appended_photos: true };
                                if (thumbnail_url && existingPhotos.length === 0) {
                                    updatePayload.thumbnail_url = thumbnail_url;
                                }
                                await supabase
                                    .from("telegram_indexed_stls")
                                    .update(updatePayload)
                                    .eq("id", existingStl.id);
                            }
                            else {
                                console.log(`[Scraper Buffer] Nenhuma foto genuinamente nova para STL ${existingStl.id}. Sem revisão necessária.`);
                            }
                        }
                    }
                    continue; // Pula o processamento deste arquivo
                }
                // Verificar jobs em andamento ou pendentes
                const { data: existingJob } = await supabase
                    .from("telegram_scraper_jobs")
                    .select("id, photos")
                    .eq("file_name", fileName)
                    .eq("file_size_bytes", fileSize)
                    .in("status", ["downloading_file", "uploading_vault", "indexing", "pending_approval"])
                    .limit(1)
                    .maybeSingle();
                if (existingJob) {
                    console.log(`[Scraper Buffer] Arquivo ${fileName} já está na fila/aprovação. Ignorando re-inclusão.`);
                    if (matchedPhotos.length > 0) {
                        const existingPhotos = existingJob.photos || [];
                        const entityId = `job:${existingJob.id}`;
                        const tempDir = path_1.default.join(__dirname, "../.temp");
                        const urlDeduped = matchedPhotos.filter(p => !existingPhotos.includes(p));
                        if (urlDeduped.length > 0) {
                            const existingHashSet = await buildEntityPhotoHashSet(entityId, existingPhotos, tempDir);
                            const trulyNewPhotos = await deduplicatePhotos(urlDeduped, photoHashByUrl, existingHashSet, entityId, bannedHashes, tempDir, `[Photo Filter Job ${existingJob.id}]`);
                            if (trulyNewPhotos.length > 0) {
                                console.log(`[Scraper Buffer] Adicionando ${trulyNewPhotos.length} foto(s) genuinamente nova(s) ao job existente ${existingJob.id}`);
                                const updatedPhotos = [...existingPhotos, ...trulyNewPhotos];
                                await supabase
                                    .from("telegram_scraper_jobs")
                                    .update({ photos: updatedPhotos })
                                    .eq("id", existingJob.id);
                            }
                            else {
                                console.log(`[Scraper Buffer] Nenhuma foto genuinamente nova para job ${existingJob.id}.`);
                            }
                        }
                    }
                    continue; // Pula
                }
            }
            catch (checkErr) {
                console.error(`[Scraper Buffer] Erro ao verificar duplicatas para ${fileName}:`, checkErr.message);
            }
            // --- FIM DUPLICATION CHECK ---
            if (fileSize > sizeLimitBytes) {
                console.log(`[Scraper Buffer] Arquivo ${fileName} muito grande (${fileSize} bytes). Salvando para aprovação do admin...`);
                try {
                    const { data: jobData, error: jobErr } = await supabase
                        .from("telegram_scraper_jobs")
                        .insert({
                        file_name: fileName,
                        chat_title: buffer.chatTitle,
                        status: "pending_approval",
                        file_size_bytes: fileSize,
                        telegram_message_id: docMsg.id,
                        telegram_group_id: String(docMsg.chatId),
                        photos: matchedPhotos,
                        printer_type: groupPrinterTypes.get(String(docMsg.chatId)) || "fdm"
                    })
                        .select("id")
                        .single();
                    if (jobErr) {
                        console.error(`[Scraper Monitor] Erro ao registrar job pendente no banco:`, jobErr.message);
                    }
                    else if (jobData) {
                        console.log(`[Scraper Monitor] Job registrado para aprovação com ID: ${jobData.id}`);
                    }
                }
                catch (jobEx) {
                    console.error(`[Scraper Monitor] Exceção ao registrar job pendente:`, jobEx.message);
                }
                continue;
            }
            console.log(`[Scraper Buffer] Processando documento: ${fileName} (${fileSize} bytes)...`);
            // Criar registro de job inicial no banco de dados para monitoramento do admin
            try {
                const { data: jobData, error: jobErr } = await supabase
                    .from("telegram_scraper_jobs")
                    .insert({
                    file_name: fileName,
                    chat_title: buffer.chatTitle,
                    status: "downloading_file",
                    file_size_bytes: fileSize,
                    telegram_message_id: docMsg.id,
                    telegram_group_id: String(docMsg.chatId),
                    photos: matchedPhotos,
                    printer_type: groupPrinterTypes.get(String(docMsg.chatId)) || "fdm"
                })
                    .select("id")
                    .single();
                if (jobErr) {
                    console.error(`[Scraper Monitor] Erro ao registrar job no banco:`, jobErr.message);
                }
                else if (jobData) {
                    jobId = jobData.id;
                    console.log(`[Scraper Monitor] Job registrado com ID: ${jobId}`);
                }
            }
            catch (jobEx) {
                console.error(`[Scraper Monitor] Exceção ao registrar job no banco:`, jobEx.message);
            }
            // A. Baixar o documento para o disco
            const tempDir = path_1.default.join(__dirname, "../.temp");
            if (!fs_1.default.existsSync(tempDir)) {
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            }
            const safeFileName = fileName.replace(/[^\w\.\-]/g, "_");
            tempFilePath = path_1.default.join(tempDir, `${Date.now()}_${safeFileName}`);
            console.log(`[Scraper Buffer] Baixando ${fileName} para o disco...`);
            const mediaData = await downloadMediaWithTimeout(client, docMsg, tempFilePath, 60000, jobId);
            if (!mediaData || typeof mediaData !== "string" || !fs_1.default.existsSync(mediaData)) {
                console.error(`[Scraper Buffer] Erro ao salvar o documento ${fileName} no disco.`);
                await updateJobStatus("failed", "Erro ao salvar o documento no disco.");
                continue;
            }
            // Preparar metadados e tags para hashtags
            const stopWords = new Set([
                "zip", "rar", "stl", "3mf", "3d", "print", "model", "free", "with", "and", "the", "for", "from",
                "para", "com", "del", "dos", "das", "uma", "uns", "sob", "sem", "sobre", "por", "que", "keychain",
                "planter", "download", "gratis", "completo", "link", "key", "v2"
            ]);
            const tags = fileName
                .toLowerCase()
                .replace(/\.[^/.]+$/, "") // remove extensão final
                .split(/[_\-\s\.\,\(\)\[\]\–]+/)
                .map(t => t.trim())
                .filter(t => t.length > 2 && !stopWords.has(t) && /^[a-z0-9\u00C0-\u00FF]+$/i.test(t));
            const title = fileName
                .replace(/\.[^/.]+$/, "") // remove a extensão final (.zip, .rar, etc.)
                .replace(/\.(stl|3mf|zip|rar|7z|gcode)$/i, "") // remove extensões internas (.3mf, .stl, etc.)
                .replace(/[_\-]+/g, " "); // substitui under/hifen por espaço
            const titleFormatted = title.charAt(0).toUpperCase() + title.slice(1);
            const hashtagStr = tags.map(t => `#${t}`).join(" ");
            // B. Enviar para o Vault do Telegram
            await updateJobStatus("uploading_vault");
            console.log(`[Scraper Buffer] Enviando cópia do documento para o Vault...`);
            const toUpload = new uploads_1.CustomFile(fileName, Number(doc.size), mediaData);
            const vaultEntity = await withTimeout(client.getEntity(vaultChannelId), 20_000, "Timeout ao obter entidade do Vault");
            const sentMessage = await withTimeout(client.sendFile(vaultEntity, {
                file: toUpload,
                caption: `LB Vault: ${titleFormatted}\nOrigem: ${buffer.chatTitle}${hashtagStr ? `\n\n${hashtagStr}` : ""}`,
            }), 25 * 60_000, "Timeout ao enviar arquivo para o Vault (25 min)");
            // C. Limpar arquivo temporário do documento
            try {
                fs_1.default.unlinkSync(mediaData);
                console.log(`[Scraper Buffer] Documento temporário limpo.`);
            }
            catch (err) {
                console.warn(`[Scraper Buffer] Não foi possível deletar o documento temporário:`, err.message);
            }
            // D. Indexar no Supabase
            await updateJobStatus("indexing");
            console.log(`[Scraper Buffer] Salvando metadados do documento no Supabase...`);
            const hasPhotos = matchedPhotos.length > 0;
            const thumbnail_url = hasPhotos ? matchedPhotos[0] : "https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=500&q=80";
            const finalPhotos = hasPhotos ? matchedPhotos : [];
            const { data: insertedStl, error } = await supabase.from("telegram_indexed_stls").insert({
                title: titleFormatted,
                description: `Modelo 3D "${fileName}" indexado automaticamente do Telegram.`,
                telegram_group_id: String(docMsg.chatId),
                telegram_group_name: buffer.chatTitle,
                telegram_message_id: sentMessage.id, // O ID no nosso Vault
                file_name: fileName,
                file_size_bytes: Number(doc.size),
                tags: tags,
                thumbnail_url: thumbnail_url,
                photos: finalPhotos,
                printer_type: groupPrinterTypes.get(String(docMsg.chatId)) || "fdm"
            }).select("id").single();
            if (error) {
                console.error(`[Scraper Buffer] Erro ao salvar no banco:`, error.message);
                await updateJobStatus("failed", `Erro ao salvar no Supabase: ${error.message}`);
            }
            else {
                console.log(`[Scraper Buffer] Modelo "${fileName}" indexado com sucesso com ${finalPhotos.length} fotos!`);
                await updateJobStatus("completed");
                // Registra hashes das fotos do novo STL nos caches para
                // que futuras postagens do mesmo arquivo não as re-adicionem
                if (insertedStl?.id && finalPhotos.length > 0) {
                    const stlEntityId = `stl:${insertedStl.id}`;
                    const hashSet = new Set();
                    for (const url of finalPhotos) {
                        const h = photoHashByUrl.get(url);
                        if (h) {
                            globalPhotoHashCache.set(h, stlEntityId);
                            hashSet.add(h);
                        }
                    }
                    if (hashSet.size > 0)
                        entityPhotoHashCache.set(stlEntityId, hashSet);
                }
            }
        }
        catch (err) {
            console.error(`[Scraper Buffer] Erro ao processar documento:`, err.message);
            if (jobId) {
                await updateJobStatus("failed", err.message || "Erro desconhecido durante o processamento.");
            }
            if (tempFilePath && fs_1.default.existsSync(tempFilePath)) {
                try {
                    fs_1.default.unlinkSync(tempFilePath);
                    console.log(`[Scraper Buffer] Arquivo temporário de falha limpo com sucesso.`);
                }
                catch (e) {
                    console.warn(`[Scraper Buffer] Não foi possível deletar o arquivo temporário de falha:`, e.message);
                }
            }
        }
    }
}
async function processApprovedJob(client, job) {
    const { id: jobId, telegram_group_id, telegram_message_id, file_name, chat_title, photos } = job;
    const updateJobStatus = async (status, errorMessage) => {
        try {
            await supabase
                .from("telegram_scraper_jobs")
                .update({
                status,
                error_message: errorMessage || null,
                updated_at: new Date().toISOString(),
            })
                .eq("id", jobId);
        }
        catch (ex) {
            console.error(`[Scraper Approved] Erro ao atualizar job ${jobId}:`, ex.message);
        }
    };
    let tempFilePath = null;
    try {
        console.log(`[Scraper Approved] Processando job aprovado ${jobId}: ${file_name}`);
        await updateJobStatus("downloading_file");
        const targetChat = String(telegram_group_id);
        const messages = await withTimeout(client.getMessages(targetChat, { ids: [parseInt(String(telegram_message_id), 10)] }), 30_000, "Timeout ao buscar mensagem do Telegram (30s)");
        if (!messages || messages.length === 0 || !messages[0].media) {
            throw new Error("Mensagem ou mídia do Telegram não encontrada.");
        }
        const docMsg = messages[0];
        const doc = docMsg.media?.document;
        // A. Baixar o documento para o disco
        const tempDir = path_1.default.join(__dirname, "../.temp");
        if (!fs_1.default.existsSync(tempDir)) {
            fs_1.default.mkdirSync(tempDir, { recursive: true });
        }
        const safeFileName = file_name.replace(/[^\w\.\-]/g, "_");
        tempFilePath = path_1.default.join(tempDir, `${Date.now()}_${safeFileName}`);
        console.log(`[Scraper Approved] Baixando ${file_name} para o disco...`);
        const mediaData = await downloadMediaWithTimeout(client, docMsg, tempFilePath, 60000, jobId, async (percent) => {
            // Opcionalmente, ignoramos a atualização no banco de dados para poupar escritas
            // e contamos apenas com o endpoint in-memory /progress
        });
        if (!mediaData || typeof mediaData !== "string" || !fs_1.default.existsSync(mediaData)) {
            throw new Error("Erro ao salvar o documento no disco.");
        }
        // B. Enviar para o Vault do Telegram
        await updateJobStatus("uploading_vault");
        console.log(`[Scraper Approved] Enviando para o Vault...`);
        const toUpload = new uploads_1.CustomFile(file_name, Number(doc.size), mediaData);
        const vaultEntity = await withTimeout(client.getEntity(vaultChannelId), 20_000, "Timeout ao obter entidade do Vault");
        const sentMessage = await withTimeout(client.sendFile(vaultEntity, {
            file: toUpload,
            caption: `LB Vault: ${file_name.replace(/\.[^/.]+$/, "").replace(/[_\-]+/g, " ")}\nOrigem: ${chat_title}`,
        }), 25 * 60_000, "Timeout ao enviar arquivo para o Vault (25 min)");
        // C. Limpar arquivo temporário do documento
        try {
            fs_1.default.unlinkSync(mediaData);
            console.log(`[Scraper Approved] Documento temporário limpo.`);
        }
        catch (e) {
            console.warn(`[Scraper Approved] Não foi possível deletar o documento temporário:`, e.message);
        }
        // D. Indexar no Supabase
        await updateJobStatus("indexing");
        console.log(`[Scraper Approved] Salvando metadados no Supabase...`);
        const stopWords = new Set([
            "zip", "rar", "stl", "3mf", "3d", "print", "model", "free", "with", "and", "the", "for", "from",
            "para", "com", "del", "dos", "das", "uma", "uns", "sob", "sem", "sobre", "por", "que", "keychain",
            "planter", "download", "gratis", "completo", "link", "key", "v2"
        ]);
        const tags = file_name
            .toLowerCase()
            .replace(/\.[^/.]+$/, "")
            .split(/[_\-\s\.\,\(\)\[\]\–]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 2 && !stopWords.has(t) && /^[a-z0-9\u00C0-\u00FF]+$/i.test(t));
        const title = file_name
            .replace(/\.[^/.]+$/, "")
            .replace(/\.(stl|3mf|zip|rar|7z|gcode)$/i, "")
            .replace(/[_\-]+/g, " ");
        const titleFormatted = title.charAt(0).toUpperCase() + title.slice(1);
        const hasPhotos = photos && photos.length > 0;
        const thumbnail_url = hasPhotos ? photos[0] : "https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=500&q=80";
        const { error } = await supabase.from("telegram_indexed_stls").insert({
            title: titleFormatted,
            description: `Modelo 3D "${file_name}" indexado automaticamente após aprovação do admin.`,
            telegram_group_id: String(telegram_group_id),
            telegram_group_name: chat_title,
            telegram_message_id: sentMessage.id,
            file_name: file_name,
            file_size_bytes: Number(doc.size),
            tags: tags,
            thumbnail_url: thumbnail_url,
            photos: photos || [],
            printer_type: job.printer_type || groupPrinterTypes.get(String(telegram_group_id)) || "fdm"
        });
        if (error) {
            throw new Error(`Erro ao salvar no Supabase: ${error.message}`);
        }
        else {
            console.log(`[Scraper Approved] Modelo "${file_name}" indexado com sucesso!`);
            await updateJobStatus("completed");
        }
    }
    catch (err) {
        console.error(`[Scraper Approved] Erro ao processar job aprovado:`, err.message);
        await updateJobStatus("failed", err.message || "Erro desconhecido.");
        if (tempFilePath && fs_1.default.existsSync(tempFilePath)) {
            try {
                fs_1.default.unlinkSync(tempFilePath);
            }
            catch (e) { }
        }
    }
}
async function loadDynamicSettings(client, dialogs) {
    try {
        const { data, error } = await supabase
            .from("telegram_scraper_settings")
            .select("*")
            .eq("id", "default")
            .single();
        if (error) {
            console.error("[Scraper Settings] Erro ao carregar configurações do banco:", error.message);
            return;
        }
        if (data) {
            // Atualiza o heartbeat no banco para indicar que o scraper está ativo e saudável
            supabase
                .from("telegram_scraper_settings")
                .update({ last_heartbeat: new Date().toISOString() })
                .eq("id", "default")
                .then(({ error: hbErr }) => {
                if (hbErr) {
                    console.error("[Scraper Status] Erro ao atualizar heartbeat:", hbErr.message);
                }
                else {
                    lastHeartbeatSuccess = Date.now();
                }
            });
            const dbLimitMb = data.size_limit_mb || 750;
            sizeLimitBytes = dbLimitMb * 1024 * 1024;
            const dbGroupsConfig = data.groups_config || [];
            const groupsChanged = JSON.stringify([...dbGroupsConfig]) !== JSON.stringify([...targetGroupsConfigCache]);
            if (groupsChanged) {
                console.log("[Scraper Settings] Alteração na lista de grupos monitorados detectada. Re-resolvendo IDs...");
                targetGroupsConfigCache = dbGroupsConfig;
                const newGroupIds = new Set();
                groupPrinterTypes.clear();
                for (const gConfig of dbGroupsConfig) {
                    const group = gConfig.id;
                    const pType = gConfig.type || "fdm";
                    if (group.match(/^\-?\d+$/)) {
                        newGroupIds.add(group);
                        groupPrinterTypes.set(group, pType);
                        if (group.startsWith("-100")) {
                            newGroupIds.add(group.substring(4));
                            groupPrinterTypes.set(group.substring(4), pType);
                        }
                        else {
                            newGroupIds.add("-100" + group);
                            groupPrinterTypes.set("-100" + group, pType);
                        }
                        continue;
                    }
                    const foundDialog = dialogs.find(d => (d.title && d.title.toLowerCase() === group.toLowerCase()) ||
                        (d.entity && 'username' in d.entity && d.entity.username && d.entity.username.toLowerCase() === group.toLowerCase()));
                    if (foundDialog) {
                        const idStr = String(foundDialog.id);
                        newGroupIds.add(idStr);
                        groupPrinterTypes.set(idStr, pType);
                        if (foundDialog.entity && 'id' in foundDialog.entity) {
                            newGroupIds.add(String(foundDialog.entity.id));
                            groupPrinterTypes.set(String(foundDialog.entity.id), pType);
                        }
                        console.log(`Grupo "${group}" encontrado nos diálogos. ID mapeado: ${idStr}`);
                    }
                    else {
                        try {
                            const entity = await client.getEntity(group);
                            if (entity) {
                                const idStr = String(entity.id);
                                newGroupIds.add(idStr);
                                newGroupIds.add("-100" + idStr);
                                groupPrinterTypes.set(idStr, pType);
                                groupPrinterTypes.set("-100" + idStr, pType);
                                console.log(`Grupo "${group}" resolvido via API. ID mapeado: ${idStr}`);
                            }
                        }
                        catch (err) {
                            console.warn(`Não foi possível resolver o grupo "${group}" via API:`, err.message);
                        }
                    }
                }
                targetGroupIds = newGroupIds;
                console.log(`[Scraper Settings] Novos IDs monitorados carregados: ${Array.from(targetGroupIds).join(", ")}`);
            }
        }
    }
    catch (err) {
        console.error("[Scraper Settings] Exceção ao carregar configurações:", err.message);
    }
}
async function startScraper() {
    if (!apiId || !apiHash) {
        console.error("ERRO: TELEGRAM_API_ID e TELEGRAM_API_HASH são obrigatórios no arquivo .env");
        process.exit(1);
    }
    console.log("Conectando ao Telegram...");
    const client = new telegram_1.TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    await client.start({
        phoneNumber: async () => await askQuestion("Digite seu número de telefone (com DDI, ex: +5511999999999): "),
        password: async () => await askQuestion("Digite sua senha de 2FA (se aplicável): "),
        phoneCode: async () => await askQuestion("Digite o código de verificação recebido no Telegram: "),
        onError: (err) => console.error("Erro na autenticação:", err),
    });
    console.log("Conectado com sucesso!");
    // Obter o ID do próprio userbot logado
    try {
        const me = await client.getMe();
        if (me && 'id' in me) {
            myId = String(me.id);
            console.log(`[Scraper] Logado como usuário/bot ID: ${myId}`);
        }
    }
    catch (err) {
        console.warn("[Scraper] Não foi possível obter informações do próprio usuário:", err.message);
    }
    // Se for a primeira conexão, imprime a Session String para salvar no .env
    if (!sessionString) {
        const savedSession = client.session.save();
        console.log("\n==================================================================");
        console.log("PRIMEIRO LOGIN DETECTADO! COPIE A LINHA ABAIXO E SALVE NO SEU .ENV:");
        console.log(`TELEGRAM_SESSION=${savedSession}`);
        console.log("==================================================================\n");
    }
    // Carrega diálogos para preencher o cache de entidades do GramJS
    console.log("Carregando diálogos...");
    let dialogs = [];
    try {
        dialogs = await client.getDialogs();
        console.log("Diálogos carregados com sucesso!");
    }
    catch (err) {
        console.warn("Aviso ao carregar diálogos:", err.message);
    }
    // --- Resolver IDs de grupos monitorados de forma dinâmica e reativa ---
    await loadDynamicSettings(client, dialogs);
    // Carrega cache de hashes de fotos do disco (sobrevive a reinicializações)
    loadHashCache();
    // Salva cache a cada 10 minutos e também ao encerrar o processo
    setInterval(saveHashCache, 10 * 60_000);
    process.on("SIGINT", () => { saveHashCache(); process.exit(0); });
    process.on("SIGTERM", () => { saveHashCache(); process.exit(0); });
    // Intervalo periódico de 60 segundos para recarregar configurações do banco
    setInterval(async () => {
        await loadDynamicSettings(client, dialogs);
    }, 60000);
    // Heartbeat dedicado e independente — atualiza a cada 30s sem depender de loadDynamicSettings.
    // Garante que o painel admin sempre exibe status atual mesmo se a resolução de grupos estiver lenta.
    setInterval(async () => {
        try {
            const { error } = await supabase
                .from("telegram_scraper_settings")
                .update({ last_heartbeat: new Date().toISOString() })
                .eq("id", "default");
            if (!error) {
                lastHeartbeatSuccess = Date.now();
            }
        }
        catch (err) {
            console.error("[Heartbeat] Falha ao atualizar:", err.message);
        }
    }, 30_000);
    // Resgata jobs que ficaram perdidos no status 'pending' após um crash ou restart
    const { data: pendingJobs } = await supabase
        .from("telegram_scraper_jobs")
        .select("*")
        .in("status", ["pending", "downloading_file", "uploading_vault", "indexing"]);
    if (pendingJobs && pendingJobs.length > 0) {
        console.log(`[Startup] Encontrados ${pendingJobs.length} jobs travados. Recolocando na fila de download...`);
        for (const job of pendingJobs) {
            queue.push(async () => {
                await processApprovedJob(client, job);
            });
        }
        triggerQueue();
    }
    // --- 1. Lógica do Servidor Proxy de Download (Next.js -> Userbot) ---
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Rota de Download por mensagem
    app.get("/download", async (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (proxyApiKey && apiKey !== proxyApiKey) {
            return res.status(401).json({ error: "Não autorizado." });
        }
        const { message_id, group_id } = req.query;
        if (!message_id) {
            return res.status(400).json({ error: "message_id é obrigatório." });
        }
        try {
            console.log(`[Proxy] Iniciando download da mensagem ${message_id} do canal/grupo ${group_id || vaultChannelId}`);
            const targetChat = group_id ? String(group_id) : String(vaultChannelId);
            // Busca a mensagem específica
            const messages = await client.getMessages(targetChat, {
                ids: [parseInt(String(message_id), 10)],
            });
            if (!messages || messages.length === 0 || !messages[0].media) {
                return res.status(404).json({ error: "Mensagem ou mídia não encontrada." });
            }
            const message = messages[0];
            // Define headers para download/stream
            res.setHeader("Content-Type", "application/octet-stream");
            let filename = "modelo.stl";
            if (message.media && 'document' in message.media) {
                const doc = message.media.document;
                const attr = doc.attributes?.find((a) => 'fileName' in a);
                if (attr)
                    filename = attr.fileName;
                if (doc.size) {
                    res.setHeader("Content-Length", doc.size);
                }
            }
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
            // Stream dos buffers baixados do Telegram
            // O SDK gramjs fornece um gerador assíncrono para baixar pedaços da mídia
            const fileStream = client.iterDownload({
                file: message.media,
                requestSize: 64 * 1024,
            });
            let clientClosed = false;
            req.on('close', () => {
                clientClosed = true;
            });
            for await (const chunk of fileStream) {
                if (clientClosed)
                    break;
                if (!res.write(chunk)) {
                    await new Promise(resolve => res.once('drain', resolve));
                }
            }
            if (!clientClosed) {
                res.end();
            }
            console.log(`[Proxy] Download concluído para: ${filename}`);
        }
        catch (err) {
            console.error("[Proxy] Erro ao baixar arquivo:", err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: "Falha ao processar download do arquivo do Telegram." });
            }
        }
    });
    // Rota de Aprovação de Job
    app.get("/approve", async (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (proxyApiKey && apiKey !== proxyApiKey) {
            return res.status(401).json({ error: "Não autorizado." });
        }
        const { job_id } = req.query;
        if (!job_id) {
            return res.status(400).json({ error: "job_id é obrigatório." });
        }
        try {
            console.log(`[Proxy] Recebida aprovação para o job: ${job_id}`);
            const { data: job, error } = await supabase
                .from("telegram_scraper_jobs")
                .select("*")
                .eq("id", String(job_id))
                .single();
            if (error || !job) {
                return res.status(404).json({ error: "Job não encontrado." });
            }
            if (job.status !== "pending_approval") {
                return res.status(400).json({ error: "Este job não está aguardando aprovação." });
            }
            // Atualiza o status para pending (na fila) primeiro para evitar race condition
            await supabase
                .from("telegram_scraper_jobs")
                .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
                .eq("id", String(job_id));
            // Adiciona na fila sequencial
            queue.push(async () => {
                await processApprovedJob(client, job);
            });
            triggerQueue();
            return res.json({ success: true, message: "Job adicionado à fila de processamento." });
        }
        catch (err) {
            console.error("[Proxy] Erro ao aprovar job:", err.message);
            return res.status(500).json({ error: err.message });
        }
    });
    // Rota de Re-processamento (Retry) de Job
    app.get("/retry", async (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (proxyApiKey && apiKey !== proxyApiKey) {
            return res.status(401).json({ error: "Não autorizado." });
        }
        const { job_id } = req.query;
        if (!job_id) {
            return res.status(400).json({ error: "job_id é obrigatório." });
        }
        try {
            console.log(`[Proxy] Recebido retry para o job: ${job_id}`);
            const { data: job, error } = await supabase
                .from("telegram_scraper_jobs")
                .select("*")
                .eq("id", String(job_id))
                .single();
            if (error || !job) {
                return res.status(404).json({ error: "Job não encontrado." });
            }
            // Atualiza o status para pending (na fila) primeiro para evitar race condition
            await supabase
                .from("telegram_scraper_jobs")
                .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
                .eq("id", String(job_id));
            // Adiciona na fila sequencial
            queue.push(async () => {
                await processApprovedJob(client, job);
            });
            triggerQueue();
            return res.json({ success: true, message: "Job adicionado à fila para reprocessamento." });
        }
        catch (err) {
            console.error("[Proxy] Erro ao re-processar job:", err.message);
            return res.status(500).json({ error: err.message });
        }
    });
    // Rota de Cancelamento de Job
    app.get("/cancel", async (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (proxyApiKey && apiKey !== proxyApiKey) {
            return res.status(401).json({ error: "Não autorizado." });
        }
        const { job_id } = req.query;
        if (!job_id) {
            return res.status(400).json({ error: "job_id é obrigatório." });
        }
        try {
            console.log(`[Proxy] Recebida solicitação de cancelamento para o job: ${job_id}`);
            const jobIdStr = String(job_id);
            cancelledJobs.add(jobIdStr);
            await supabase
                .from("telegram_scraper_jobs")
                .update({
                status: "failed",
                error_message: "Cancelado pelo administrador.",
                updated_at: new Date().toISOString()
            })
                .eq("id", jobIdStr);
            return res.json({ success: true, message: "Job cancelado com sucesso." });
        }
        catch (err) {
            console.error("[Proxy] Erro ao cancelar job:", err.message);
            return res.status(500).json({ error: err.message });
        }
    });
    // Rota de Consulta de Progresso (In-Memory)
    app.get("/progress", async (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (proxyApiKey && apiKey !== proxyApiKey) {
            return res.status(401).json({ error: "Não autorizado." });
        }
        const { job_id } = req.query;
        if (!job_id) {
            return res.status(400).json({ error: "job_id é obrigatório." });
        }
        const progress = activeDownloads.get(String(job_id)) || 0;
        return res.json({ job_id, progress });
    });
    // ─── Endpoint de Backfill / Varredura Retroativa ─────────────────────────────
    // Permite reprocessar mensagens históricas de um período específico sem reiniciar o scraper.
    // Útil quando o scraper ficou offline por horas e precisa recuperar arquivos perdidos.
    app.post("/backfill", async (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (proxyApiKey && apiKey !== proxyApiKey) {
            return res.status(401).json({ error: "Não autorizado." });
        }
        const { hours_back = 6, group_ids } = req.body;
        if (!hours_back || hours_back < 1 || hours_back > 168) {
            return res.status(400).json({ error: "hours_back deve ser entre 1 e 168 (1 semana)." });
        }
        const cutoffDate = new Date(Date.now() - hours_back * 60 * 60 * 1000);
        const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000); // Unix timestamp em segundos
        console.log(`[Backfill] Iniciando varredura retroativa das últimas ${hours_back}h (desde ${cutoffDate.toISOString()})...`);
        // Responde imediatamente — a varredura roda em background
        res.json({
            ok: true,
            message: `Varredura retroativa iniciada para as últimas ${hours_back}h. Acompanhe o progresso na aba de jobs do painel admin.`,
            cutoff_date: cutoffDate.toISOString(),
        });
        // Executa em background sem bloquear a resposta HTTP
        setImmediate(async () => {
            let totalQueued = 0;
            let totalSkipped = 0;
            try {
                const dialogs = await client.getDialogs({ limit: 200 });
                for (const dialog of dialogs) {
                    const dialogIdStr = String(dialog.id);
                    // Filtra apenas grupos monitorados (ou os IDs específicos solicitados)
                    const isMonitored = targetGroupIds.has(dialogIdStr) || targetGroupIds.has("-100" + dialogIdStr);
                    const isRequested = !group_ids || group_ids.length === 0 || group_ids.includes(dialogIdStr);
                    if (!isMonitored || !isRequested)
                        continue;
                    // Ignora o canal Vault
                    const normDialogId = dialogIdStr.startsWith("-100") ? dialogIdStr.substring(4) : dialogIdStr;
                    const normVaultId = vaultChannelId ? (vaultChannelId.startsWith("-100") ? vaultChannelId.substring(4) : vaultChannelId) : "";
                    if (normVaultId && normDialogId === normVaultId)
                        continue;
                    console.log(`[Backfill] Varrendo grupo "${dialog.title}" (${dialogIdStr}) desde ${cutoffDate.toISOString()}...`);
                    try {
                        // Busca até 500 mensagens do período — desce do mais recente para o mais antigo
                        const messages = await client.getMessages(dialog.entity, {
                            limit: 500,
                            offsetDate: undefined, // pega as mais recentes primeiro
                        });
                        // Filtra mensagens dentro da janela de tempo solicitada
                        const messagesInWindow = messages.filter((m) => {
                            if (!m.date)
                                return false;
                            const msgTimestamp = typeof m.date === "number" ? m.date : Math.floor(new Date(m.date).getTime() / 1000);
                            return msgTimestamp >= cutoffTimestamp;
                        });
                        console.log(`[Backfill] "${dialog.title}": ${messages.length} msgs buscadas, ${messagesInWindow.length} dentro da janela de ${hours_back}h.`);
                        for (const msg of [...messagesInWindow].reverse()) {
                            // Ignora mensagens do próprio userbot
                            const senderIdStr = msg.senderId ? String(msg.senderId) : null;
                            if (myId && senderIdStr === myId)
                                continue;
                            // Verifica se possui mídia elegível
                            const isDoc = msg.media && "document" in msg.media;
                            const isPhoto = !!(msg.photo || (msg.media && ("photo" in msg.media || msg.media.className === "MessageMediaPhoto")));
                            if (!isDoc && !isPhoto)
                                continue;
                            if (isDoc) {
                                const doc = msg.media.document;
                                let fileName = "arquivo.stl";
                                const attr = doc.attributes?.find((a) => "fileName" in a);
                                if (attr)
                                    fileName = attr.fileName;
                                const isStl = fileName.endsWith(".stl") || (doc.mimeType && doc.mimeType.includes("stl"));
                                const is3mf = fileName.endsWith(".3mf") || (doc.mimeType && doc.mimeType.includes("3mf"));
                                const isCompressed = fileName.endsWith(".zip") || fileName.endsWith(".rar") || fileName.endsWith(".7z");
                                if (!isStl && !is3mf && !isCompressed)
                                    continue;
                            }
                            // Verifica duplicata no índice
                            const { data: existing } = await supabase
                                .from("telegram_indexed_stls")
                                .select("id")
                                .eq("telegram_message_id", msg.id)
                                .eq("telegram_group_name", dialog.title)
                                .limit(1);
                            if (existing && existing.length > 0) {
                                totalSkipped++;
                                continue;
                            }
                            // Verifica duplicata nos jobs
                            const { data: existingJob } = await supabase
                                .from("telegram_scraper_jobs")
                                .select("id")
                                .eq("telegram_message_id", msg.id)
                                .eq("chat_title", dialog.title)
                                .limit(1);
                            if (existingJob && existingJob.length > 0) {
                                totalSkipped++;
                                continue;
                            }
                            console.log(`[Backfill] Novo arquivo encontrado! Msg ID ${msg.id} em "${dialog.title}". Enfileirando...`);
                            totalQueued++;
                            await handleIncomingMessage(client, msg);
                        }
                    }
                    catch (err) {
                        console.error(`[Backfill] Erro ao varrer grupo "${dialog.title}":`, err.message);
                    }
                }
                console.log(`[Backfill] Varredura concluída. ${totalQueued} novos arquivos enfileirados, ${totalSkipped} duplicatas ignoradas.`);
            }
            catch (err) {
                console.error("[Backfill] Erro fatal durante a varredura:", err.message);
            }
        });
    });
    app.listen(port, () => {
        console.log(`Servidor de download proxy rodando na porta ${port}`);
    });
    // Processador compartilhado de mensagens de mídia
    const handleIncomingMessage = async (client, message) => {
        try {
            const isDoc = message.media && "document" in message.media;
            const isPhoto = !!(message.photo ||
                (message.media && ("photo" in message.media || message.media.className === "MessageMediaPhoto")));
            if (!isDoc && !isPhoto) {
                return;
            }
            let type = "photo";
            if (isDoc) {
                const doc = message.media.document;
                let fileName = "arquivo.stl";
                const attr = doc.attributes?.find((a) => "fileName" in a);
                if (attr)
                    fileName = attr.fileName;
                const isStl = fileName.endsWith(".stl") || (doc.mimeType && doc.mimeType.includes("stl"));
                const is3mf = fileName.endsWith(".3mf") || (doc.mimeType && doc.mimeType.includes("3mf"));
                const isCompressed = fileName.endsWith(".zip") || fileName.endsWith(".rar") || fileName.endsWith(".7z");
                if (!isStl && !is3mf && !isCompressed) {
                    return; // Ignora documentos que não sejam STLs, 3MFs ou compactados
                }
                type = "document";
            }
            const chat = await message.getChat();
            const chatTitle = chat?.title || "Telegram Group";
            const senderId = message.senderId ? String(message.senderId) : "unknown";
            const chatId = String(message.chatId);
            const bufferKey = `${chatId}_${senderId}`;
            console.log(`[Scraper] Nova mídia detectada (${type}) no chat "${chatTitle}". Adicionando ao buffer de agrupamento...`);
            let buffer = activeBuffers.get(bufferKey);
            if (buffer) {
                clearTimeout(buffer.timeoutId);
                buffer.messages.push({ message, type });
            }
            else {
                buffer = {
                    chatId,
                    chatTitle,
                    senderId,
                    messages: [{ message, type }],
                    timeoutId: setTimeout(() => { }, 0) // placeholder
                };
            }
            buffer.timeoutId = setTimeout(() => {
                queue.push(async () => {
                    await processBufferedEntry(client, bufferKey).catch(err => {
                        console.error(`[Scraper Buffer] Erro ao processar buffer para ${bufferKey}:`, err.message);
                    });
                });
                triggerQueue();
            }, 5000); // 5 segundos de silêncio para agrupar
            activeBuffers.set(bufferKey, buffer);
        }
        catch (err) {
            console.error("[Scraper] Erro no processamento da mensagem:", err.message);
        }
    };
    // --- 2. Lógica do Scraper / Garimpeiro ---
    console.log("Inicializando escuta de novos eventos no Telegram...");
    client.addEventHandler(async (event) => {
        try {
            // Atualiza timestamp do watchdog a cada evento recebido (mesmo os que não são dos nossos grupos)
            lastEventTimestamp = Date.now();
            const message = event.message;
            if (!message)
                return;
            const chatIdStr = String(message.chatId);
            // 1. Ignorar se a mensagem for do próprio canal Vault
            const normChatId = chatIdStr.startsWith("-100") ? chatIdStr.substring(4) : chatIdStr;
            const normVaultId = vaultChannelId ? (vaultChannelId.startsWith("-100") ? vaultChannelId.substring(4) : vaultChannelId) : "";
            if (normVaultId && normChatId === normVaultId) {
                return;
            }
            // 2. Ignorar se o remetente for o próprio userbot
            const senderIdStr = message.senderId ? String(message.senderId) : null;
            if (myId && senderIdStr === myId) {
                return;
            }
            // Verificar se a mensagem é de um dos grupos monitorados por ID de forma extremamente rápida
            const isFromTargetGroup = targetGroupIds.has(chatIdStr);
            if (!isFromTargetGroup) {
                return;
            }
            await handleIncomingMessage(client, message);
        }
        catch (err) {
            console.error("[Scraper] Erro no manipulador de eventos:", err.message);
        }
    }, new events_1.NewMessage({}));
    // --- Processar mensagens recentes não indexadas nos grupos monitorados (Backlog no Startup) ---
    console.log("[Scraper Backlog] Verificando últimas 20 mensagens em busca de arquivos não indexados...");
    for (const dialog of dialogs) {
        const dialogIdStr = String(dialog.id);
        // Ignora o canal Vault no backlog
        const normDialogId = dialogIdStr.startsWith("-100") ? dialogIdStr.substring(4) : dialogIdStr;
        const normVaultId = vaultChannelId ? (vaultChannelId.startsWith("-100") ? vaultChannelId.substring(4) : vaultChannelId) : "";
        if (normVaultId && normDialogId === normVaultId) {
            continue;
        }
        if (targetGroupIds.has(dialogIdStr)) {
            console.log(`[Scraper Backlog] Verificando histórico de "${dialog.title}" (${dialogIdStr})...`);
            try {
                const messages = await client.getMessages(dialog.entity, { limit: 20 });
                const reversedMessages = [...messages].reverse();
                for (const msg of reversedMessages) {
                    // Ignorar se a mensagem for do próprio userbot
                    const senderIdStr = msg.senderId ? String(msg.senderId) : null;
                    if (myId && senderIdStr === myId) {
                        continue;
                    }
                    // Verificar se possui mídias elegíveis
                    const isDoc = msg.media && "document" in msg.media;
                    const isPhoto = !!(msg.photo ||
                        (msg.media && ("photo" in msg.media || msg.media.className === "MessageMediaPhoto")));
                    if (!isDoc && !isPhoto)
                        continue;
                    if (isDoc) {
                        const doc = msg.media.document;
                        let fileName = "arquivo.stl";
                        const attr = doc.attributes?.find((a) => "fileName" in a);
                        if (attr)
                            fileName = attr.fileName;
                        const isStl = fileName.endsWith(".stl") || (doc.mimeType && doc.mimeType.includes("stl"));
                        const is3mf = fileName.endsWith(".3mf") || (doc.mimeType && doc.mimeType.includes("3mf"));
                        const isCompressed = fileName.endsWith(".zip") || fileName.endsWith(".rar") || fileName.endsWith(".7z");
                        if (!isStl && !is3mf && !isCompressed)
                            continue;
                    }
                    // Verificar se a mensagem já foi indexada
                    const { data: existing, error: checkError } = await supabase
                        .from("telegram_indexed_stls")
                        .select("id")
                        .eq("telegram_message_id", msg.id)
                        .eq("telegram_group_name", dialog.title)
                        .limit(1);
                    if (checkError) {
                        console.error(`[Scraper Backlog] Erro ao verificar existência da mensagem ID ${msg.id} no chat "${dialog.title}":`, checkError.message);
                        continue;
                    }
                    if (existing && existing.length > 0) {
                        continue; // Já indexado
                    }
                    // Verificar também na tabela de scraper jobs para não duplicar processamento
                    const { data: existingJob, error: checkJobError } = await supabase
                        .from("telegram_scraper_jobs")
                        .select("id")
                        .eq("telegram_message_id", msg.id)
                        .eq("chat_title", dialog.title)
                        .limit(1);
                    if (checkJobError) {
                        console.error(`[Scraper Backlog] Erro ao verificar job existente para mensagem ID ${msg.id}:`, checkJobError.message);
                        continue;
                    }
                    if (existingJob && existingJob.length > 0) {
                        continue; // Job já existe/existiu
                    }
                    console.log(`[Scraper Backlog] Mídia não indexada encontrada! Processando Msg ID ${msg.id} no chat "${dialog.title}"...`);
                    await handleIncomingMessage(client, msg);
                }
            }
            catch (err) {
                console.error(`[Scraper Backlog] Erro ao processar backlog para chat "${dialog.title}":`, err.message);
            }
        }
    }
    // --- 3. Health Check de Conexão (Ping a cada 2 min) ---
    // Verifica se o socket TCP está vivo enviando um getMe() leve.
    setInterval(async () => {
        try {
            if (!client.connected) {
                console.warn("[Health Check] Cliente desconectado! Reconectando...");
                await client.connect();
                lastEventTimestamp = Date.now(); // Reseta o watchdog após reconectar
            }
            else {
                await withTimeout(client.getMe(), 15_000, "Timeout ao obter getMe()");
                console.log("[Health Check] Ping OK. Última atualidade recebida há", Math.round((Date.now() - lastEventTimestamp) / 1000), "segundos.");
            }
        }
        catch (err) {
            console.error("[Health Check] Ping falhou:", err.message, "— Forçando reconexão completa...");
            try {
                await client.disconnect();
                await client.connect();
                lastEventTimestamp = Date.now();
                console.log("[Health Check] Reconexão completa OK.");
            }
            catch (reconnectErr) {
                console.error("[Health Check] Erro na reconexão:", reconnectErr.message);
            }
        }
    }, 120000);
    // --- 4. Watchdog de Updates (verifica a cada 3 min se estamos recebendo eventos) ---
    // O GramJS pode estar "conectado" mas o _updateLoop interno pode ter morrido silenciosamente
    // com um Error: TIMEOUT. Este watchdog detecta isso verificando se o lastEventTimestamp
    // ficou parado por mais de 5 minutos e, se sim, força um disconnect() + connect() completo
    // para reiniciar o _updateLoop e o fluxo de eventos.
    const UPDATE_STARVATION_MS = 5 * 60 * 1000; // 5 minutos sem eventos = presume-se morto
    setInterval(async () => {
        const msSinceLastEvent = Date.now() - lastEventTimestamp;
        if (msSinceLastEvent > UPDATE_STARVATION_MS) {
            console.warn(`[Watchdog] ALERTA: Nenhum evento do Telegram recebido há ${Math.round(msSinceLastEvent / 1000)}s. ` +
                `O _updateLoop pode ter morrido silenciosamente. Forçando reconexão total...`);
            try {
                await client.disconnect();
                await new Promise(r => setTimeout(r, 2000)); // Aguarda 2s antes de reconectar
                await client.connect();
                lastEventTimestamp = Date.now(); // Reseta para não reconectar em loop
                console.log("[Watchdog] Reconexão forçada concluída. Monitoramento retomado.");
            }
            catch (err) {
                console.error("[Watchdog] Erro ao forçar reconexão:", err.message);
            }
        }
        else {
            console.log(`[Watchdog] OK. Último evento há ${Math.round(msSinceLastEvent / 1000)}s.`);
        }
    }, 3 * 60 * 1000); // A cada 3 minutos
    // --- 5. Watchdog de Heartbeat Geral ---
    // Verifica se o heartbeat de configurações dinâmicas está atualizando no banco de dados.
    // Se passar mais de 5 minutos sem sucesso, o processo é encerrado para que o gerenciador de processos (PM2/Docker) o reinicie de forma limpa.
    setInterval(() => {
        const diff = Date.now() - lastHeartbeatSuccess;
        if (diff > 5 * 60 * 1000) { // 5 minutos
            console.error(`[Watchdog Heartbeat] Erro crítico: Sem atualização de heartbeat há ${Math.round(diff / 1000)}s. ` +
                `O scraper parece travado. Encerrando processo para reinicialização limpa...`);
            process.exit(1);
        }
    }, 60 * 1000); // Verifica a cada minuto
}
startScraper().catch((err) => {
    console.error("Falha fatal ao iniciar o scraper:", err);
});
