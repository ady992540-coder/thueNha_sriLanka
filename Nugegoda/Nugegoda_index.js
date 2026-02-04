const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { crawlLinks } = require('./Nugegoda_get_links');

// Configuration
const BOT_TOKEN = '8547354550:AAFZxMFWnwt9ropoxUWucM5ztME8Q860f0E';
const CHANNEL_ID = '@thueNha_srilanka_Nugegoda';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LKR_TO_VND_RATE = 85;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// File Paths
const LINKS_FILE = path.join(__dirname, 'Nugegoda_links.txt');
const HISTORY_FILE = path.join(__dirname, 'Nugegoda_sent_history.txt');
const METADATA_FILE = path.join(__dirname, 'Nugegoda_metadata.json');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateToVietnamese(dateString) {
    const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
    let translated = dateString;
    for (const [eng, vn] of Object.entries(months)) { translated = translated.replace(eng, `Tháng ${vn}`); }
    return translated.replace('am', 'sáng').replace('pm', 'chiều');
}

async function translateWithGemini(title, description, typeProp, features) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
Analyze this real estate listing:
Title: "${title}"
Description: "${description}"
Property Type: "${typeProp}"
Features: "${features}"

1. Translate all identifying text to Vietnamese. 
   - Rule: Translate "Annex" as "Khu nhà riêng biệt, độc lập với chủ nhà".
   - CRITICAL: Return ONLY the translated string. Do NOT include explanations, "The most common translation is...", or any other chatter.
2. Categorize the gender requirement into ONE of these: "Nữ" (cho nữ), "Nam" (cho nam), or "Cả hai" (cả nam và nữ).
   - CRITICAL: If the Title or Description contains "Girls", "Ladies", "Female", "Nữ", "Woman", ALWAYS classify as "Nữ". 
   - CRITICAL: If the Title or Description contains "Boys", "Gents", "Male", "Nam", "Man", ALWAYS classify as "Nam".

Return ONLY a JSON object: {"title": "...", "description": "...", "type": "...", "features": "...", "gender": "Nữ" | "Nam" | "Cả hai"}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(text);
    } catch (error) {
        console.error(`Gemini Error: ${error.message}`);
        return { title, description, type: typeProp, features: features, gender: "Cả hai" }; // Fallback
    }
}

async function scrapeAndSend(targetUrl, scrapeOnly = false) {
    try {
        console.log(`Fetching URL: ${targetUrl}`);
        const { data: html } = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(html);
        let propertyData = null;
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (scriptContent && scriptContent.includes('window.initialData')) {
                const match = scriptContent.match(/window\.initialData\s*=\s*({.*});?/);
                if (match && match[1]) { try { propertyData = JSON.parse(match[1]); } catch (e) { } }
            }
        });

        if (!propertyData || !propertyData.adDetail || !propertyData.adDetail.data || !propertyData.adDetail.data.ad) {
            console.error('Could not find property data.');
            return { success: false };
        }

        const ad = propertyData.adDetail.data.ad;
        let title = ad.title;
        let description = ad.description ? ad.description.replace(/<[^>]*>?/gm, '') : 'Không có mô tả';
        let typeProp = ad.properties.find(p => p.label === 'Property type')?.value || 'N/A';
        let features = ad.properties.filter(p => p.label === 'Features').map(p => p.value).join(', ') || 'N/A';
        let address = ad.properties.find(p => p.label === 'Address')?.value || `${ad.location.name}, ${ad.location.parent?.name}`;

        console.log("Analyzing and Translating content...");
        const geminiResult = await translateWithGemini(title, description, typeProp, features);
        title = geminiResult.title;
        description = geminiResult.description;
        typeProp = geminiResult.type;
        features = geminiResult.features;
        const gender = geminiResult.gender || "Cả hai";

        const rawTimestamp = ad.timestamp || '';
        const vnDate = formatDateToVietnamese(rawTimestamp);
        const postedOn = `Đăng ngày ${vnDate}, ${ad.location.name}, ${ad.location.parent ? ad.location.parent.name : ''}`;
        const views = ad.statistics ? ad.statistics.views : 'N/A';

        let priceString = ad.money ? ad.money.amount : (ad.price || 'Thỏa thuận');
        let priceVnd = '';
        let rawPrice = 0;
        const priceMatch = priceString.match(/([\d,]+)/);
        if (priceMatch) {
            rawPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
            priceVnd = ` (~ ${formatCurrency(rawPrice * LKR_TO_VND_RATE)})`;
        }
        const price = `${priceString.replace('/month', '/tháng')}${priceVnd}`;

        const beds = ad.properties.find(p => p.label === 'Beds')?.value || 'N/A';
        const baths = ad.properties.find(p => p.label === 'Baths')?.value || 'N/A';
        const contactName = ad.contactCard ? ad.contactCard.name : 'Unknown';
        const phoneNumbers = ad.contactCard && ad.contactCard.phoneNumbers ? ad.contactCard.phoneNumbers.map(n => n.number).join(', ') : 'N/A';
        const whatsapp = ad.contactCard && ad.contactCard.chatEnabled ? 'Có sẵn' : 'Liên hệ người bán';

        if (description.length > 250) description = description.substring(0, 250) + '...';

        const message = `<b>${title}</b>\n\n<b>Ngày đăng:</b> ${postedOn}\n<b>Lượt xem:</b> ${views}\n<b>Giá:</b> ${price}\n<b>Loại:</b> ${typeProp}\n<b>Địa chỉ:</b> ${address}\n<b>Đặc điểm:</b> ${features}\n<b>Phòng ngủ:</b> ${beds}\n<b>Phòng tắm:</b> ${baths}\n\n<b>Mô tả:</b>\n${description}\n\n<blockquote><b>Liên hệ:</b> ${contactName}\n<b>Điện thoại:</b> ${phoneNumbers}\n<b>WhatsApp:</b> ${whatsapp}</blockquote>`.trim();

        const mediaGroup = [];
        if (ad.images && ad.images.meta && Array.isArray(ad.images.meta)) {
            ad.images.meta.forEach(imgData => {
                if (imgData.src) {
                    const highResUrl = `${imgData.src}/620/466/fitted.jpg`;
                    if (!mediaGroup.find(m => m.media === highResUrl)) mediaGroup.push({ type: 'photo', media: highResUrl });
                }
            });
        }

        if (scrapeOnly) return { success: true, title, price, url: targetUrl, rawPrice, timestamp: rawTimestamp, gender };

        let messageId;
        if (mediaGroup.length > 0) {
            const album = mediaGroup.slice(0, 10);
            album[0].caption = message;
            album[0].parse_mode = 'HTML';
            const sent = await bot.sendMediaGroup(CHANNEL_ID, album);
            messageId = sent[0].message_id;
        } else {
            const sent = await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'HTML' });
            messageId = sent.message_id;
        }

        return { success: true, messageId, title, price, url: targetUrl, rawPrice, timestamp: rawTimestamp, gender };

    } catch (error) {
        console.error('Error in scrapeAndSend:', error.message);
        return { success: false };
    }
}

async function sendTOC() {
    try {
        if (!fs.existsSync(METADATA_FILE)) return;
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        if (metadata.length === 0) return;

        console.log("\n--- GENERATING SORTED & GROUPED TABLE OF CONTENTS ---");

        const sorted = [...metadata].sort((a, b) => (a.rawPrice || 0) - (b.rawPrice || 0));

        const groups = {};
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthIdx = now.getMonth(); // 0-11
        const monthsEng = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        sorted.forEach(item => {
            let monthLabel = "Chưa rõ thời gian";
            if (item.timestamp) {
                const parts = item.timestamp.split(' ');
                const monthName = parts.find(p => monthsEng.includes(p));
                const yearMatch = parts.find(p => /^\d{4}$/.test(p));

                let year = yearMatch ? parseInt(yearMatch, 10) : currentYear;

                // If it's something like "10 Dec" and we are in "Feb", it's Dec of last year
                if (!yearMatch && monthName) {
                    const adMonthIdx = monthsEng.indexOf(monthName);
                    if (adMonthIdx > currentMonthIdx) {
                        year = currentYear - 1;
                    }
                }

                if (monthName) {
                    const monthsVn = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
                    monthLabel = `Tháng ${monthsVn[monthName]}/${year}`;
                }
            }
            if (!groups[monthLabel]) groups[monthLabel] = {};

            const genderLabel = item.gender || "Cả hai";
            if (!groups[monthLabel][genderLabel]) groups[monthLabel][genderLabel] = [];
            groups[monthLabel][genderLabel].push(item);
        });

        const channelUsername = CHANNEL_ID.replace('@', '');
        const mainHeader = `<b>📑 MỤC LỤC TỔNG HỢP (Phân loại Giá/Tháng/Giới tính)</b>\n<i>(Tổng cộng ${metadata.length} tin)</i>\n\n`;
        const genderIcons = { "Nữ": "👩 Chỉ Nữ", "Nam": "👨 Chỉ Nam", "Cả hai": "👫 Cả nam và nữ" };

        let currentMsg = mainHeader;

        const flushMsg = async () => {
            if (currentMsg.trim() === mainHeader.trim()) return;
            await bot.sendMessage(CHANNEL_ID, currentMsg, { parse_mode: 'HTML', disable_web_page_preview: true });
            currentMsg = mainHeader;
        };

        // Sort months newest to oldest
        const sortedMonths = Object.keys(groups).sort((a, b) => {
            const getScore = (label) => {
                const m = label.match(/Tháng (\d+)\/(\d+)/);
                if (m) return parseInt(m[2]) * 100 + parseInt(m[1]);
                return 0;
            };
            return getScore(b) - getScore(a);
        });

        for (const month of sortedMonths) {
            const genderGroups = groups[month];
            let monthStr = `📅 <b>${month}</b>\n==========================\n`;

            if (currentMsg.length + monthStr.length > 3800) {
                await flushMsg();
                currentMsg = mainHeader + monthStr;
            } else {
                currentMsg += monthStr;
            }

            for (const genderType of ["Nữ", "Nam", "Cả hai"]) {
                const items = genderGroups[genderType];
                if (items && items.length > 0) {
                    let genderStr = `<u><b>${genderIcons[genderType]}</b></u>\n--------------------------\n`;

                    if (currentMsg.length + genderStr.length > 3800) {
                        await flushMsg();
                        currentMsg = mainHeader + `📅 <b>${month} (tiếp)</b>\n==========================\n` + genderStr;
                    } else {
                        currentMsg += genderStr;
                    }

                    let quoteStarted = false;
                    for (let i = 0; i < items.length; i++) {
                        if (!quoteStarted) {
                            currentMsg += "<blockquote>";
                            quoteStarted = true;
                        }

                        const item = items[i];
                        const linkUrl = `https://t.me/${channelUsername}/${item.messageId}`;
                        const itemStr = `${i + 1}. <a href="${linkUrl}">${item.title}</a>\n💰 ${item.price}\n\n`;

                        if (currentMsg.length + itemStr.length > 3800) {
                            currentMsg += "</blockquote>";
                            await flushMsg();
                            currentMsg = mainHeader + `📅 <b>${month} (tiếp)</b>\n==========================\n<u><b>${genderIcons[genderType]} (tiếp)</b></u>\n--------------------------\n<blockquote>`;
                            quoteStarted = true;
                        }
                        currentMsg += itemStr;
                    }
                    if (quoteStarted) currentMsg += "</blockquote>";
                }
            }
            currentMsg += `\n`;
        }

        await flushMsg();

    } catch (e) {
        console.error("TOC error:", e.message);
    }
}

function updateMetadata(item) {
    let metadata = [];
    if (fs.existsSync(METADATA_FILE)) {
        try {
            const content = fs.readFileSync(METADATA_FILE, 'utf-8');
            if (content.trim()) metadata = JSON.parse(content);
        } catch (e) { }
    }
    metadata.push(item);
    const unique = Array.from(new Map(metadata.filter(m => m.url).map(m => [m.url.split('?')[0], m])).values());
    fs.writeFileSync(METADATA_FILE, JSON.stringify(unique, null, 2));
}

async function runAutomation() {
    try {
        console.log("=== NUGEGODA AUTOMATION START ===");

        console.log("[1] Crawling for fresh links...");
        const freshLinks = await crawlLinks(false);

        let existingLinks = new Set();
        if (fs.existsSync(LINKS_FILE)) {
            fs.readFileSync(LINKS_FILE, 'utf-8').split('\n').forEach(l => {
                const t = l.trim(); if (t && t.startsWith('http')) existingLinks.add(t);
            });
        }
        const newCrawled = freshLinks.filter(l => !existingLinks.has(l));
        if (newCrawled.length > 0) {
            fs.appendFileSync(LINKS_FILE, newCrawled.join('\n') + '\n');
            console.log(`[DB] Added ${newCrawled.length} new links to link.txt`);
        }

        let history = new Set();
        if (fs.existsSync(HISTORY_FILE)) {
            fs.readFileSync(HISTORY_FILE, 'utf-8').split('\n').forEach(l => {
                const t = l.trim(); if (t) history.add(t);
            });
        }

        const allPending = fs.readFileSync(LINKS_FILE, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && l.startsWith('http') && !history.has(l));
        console.log(`[Queue] ${allPending.length} items to process.`);

        let sessionSentCount = 0;
        for (let i = 0; i < allPending.length; i++) {
            const link = allPending[i];
            console.log(`\n[${i + 1}/${allPending.length}] Processing: ${link}`);
            const result = await scrapeAndSend(link);
            if (result && result.success) {
                fs.appendFileSync(HISTORY_FILE, `${link}\n`);
                updateMetadata(result);
                sessionSentCount++;
                if (sessionSentCount % 5 === 0) {
                    await sendTOC();
                }
            }
            if (i < allPending.length - 1) await sleep(15000);
        }

        if (sessionSentCount > 0) {
            await sendTOC();
        }

        console.log("\n=== COMPLETED SUCCESSFULLY ===");
    } catch (err) {
        console.error("Critical automation error:", err);
    }
}

if (require.main === module) {
    runAutomation();
}

module.exports = { scrapeAndSend, runAutomation, sendTOC };
