const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Base URL for Maharagama listings
const BASE_URL = 'https://ikman.lk/en/ads/maharagama/room-annex-rentals?sort=date&order=desc&buy_now=0&urgent=0';
const OUTPUT_FILE = path.join(__dirname, 'Maharagama_links.txt');

const TOTAL_PAGES = 10;

// Helper to delay (avoid blocking)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function crawlLinks(saveToFile = true) {
    try {
        if (saveToFile) {
            fs.writeFileSync(OUTPUT_FILE, `Crawled Links - ${new Date().toISOString()}\n\n`);
            console.log(`Starting crawl for ${TOTAL_PAGES} pages (Saving to ${OUTPUT_FILE})...`);
        } else {
            console.log(`Starting crawl for ${TOTAL_PAGES} pages (Memory Mode)...`);
        }

        const allLinks = new Set();

        for (let page = 1; page <= TOTAL_PAGES; page++) {
            const listUrl = `${BASE_URL}&page=${page}`;
            console.log(`\n[Page ${page}/${TOTAL_PAGES}] Fetching: ${listUrl}`);

            try {
                const { data: html } = await axios.get(listUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                const $ = cheerio.load(html);
                let pageLinksCount = 0;

                $('a[class*="card-link"]').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href) {
                        const fullUrl = href.startsWith('http') ? href : `https://ikman.lk${href}`;

                        if (!allLinks.has(fullUrl)) {
                            allLinks.add(fullUrl);
                            if (saveToFile) {
                                fs.appendFileSync(OUTPUT_FILE, `${fullUrl}\n`);
                            }
                            pageLinksCount++;
                        }
                    }
                });

                console.log(`   -> Found ${pageLinksCount} new links.`);

            } catch (err) {
                console.error(`   -> Error fetching page ${page}: ${err.message}`);
            }

            await sleep(2000);
        }

        console.log(`\n----------- COMPLETED -----------`);
        console.log(`Total unique links found: ${allLinks.size}`);
        console.log('---------------------------------');

        return Array.from(allLinks);

    } catch (error) {
        console.error('Critical Error:', error.message);
        return [];
    }
}

if (require.main === module) {
    crawlLinks(true);
}

module.exports = { crawlLinks };
