#!/usr/bin/env node

/**
 * JSearch API Fetcher for Data Science Jobs
 *
 * Target: 30 jobs/day quota
 * Method: 1 request/day × 3 pages × 10 jobs = 30 jobs
 *
 * Features:
 * - 17 data science queries
 * - Query rotation (1 query per run based on hour)
 * - Rate limiting (1 request/day max)
 * - Usage tracking
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration from environment
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY;
const JSEARCH_BASE_URL = 'jsearch.p.rapidapi.com';
const MAX_REQUESTS_PER_DAY = 30;  // Paid API: 30 requests/day allocated to this repo
const USAGE_FILE = path.join(process.cwd(), '.github', 'data', 'jsearch_usage.json');

// Domain-specific search queries for Data Science
const SEARCH_QUERIES = [
    'data scientist',
    'data analyst',
    'data engineer',
    'machine learning engineer',
    'ml engineer',
    'ai engineer',
    'research scientist',
    'business analyst',
    'business intelligence analyst',
    'analytics engineer',
    'statistician',
    'quantitative analyst',
    'data science intern',
    'machine learning intern',
    'ai researcher',
    'applied scientist',
    'research engineer'
];

/**
 * Load usage tracking from file
 */
function loadUsageTracking() {
    try {
        if (fs.existsSync(USAGE_FILE)) {
            const data = fs.readFileSync(USAGE_FILE, 'utf8');
            const parsed = JSON.parse(data);

            // Reset if it's a new day
            const today = new Date().toDateString();
            if (parsed.date !== today) {
                console.log(`📅 New day detected, resetting usage tracking`);
                return {
                    date: today,
                    requests: 0,
                    remaining: MAX_REQUESTS_PER_DAY,
                    queries_executed: []
                };
            }

            return parsed;
        }
    } catch (error) {
        console.warn('⚠️ Error loading usage tracking:', error.message);
    }

    // Default tracking structure
    return {
        date: new Date().toDateString(),
        requests: 0,
        remaining: MAX_REQUESTS_PER_DAY,
        queries_executed: []
    };
}

/**
 * Save usage tracking
 */
function saveUsageTracking(data) {
    try {
        const dir = path.dirname(USAGE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('⚠️ Error saving usage tracking:', error.message);
    }
}

/**
 * Make HTTPS request to JSearch API
 */
function fetchFromJSearch(query) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            query: `${query} United States`,
            employment_types: 'FULLTIME,PARTTIME,INTERN',
            num_pages: '3',  // 3 pages × 10 jobs = 30 jobs per day total
            date_posted: 'month',
            country: 'us'
        });

        const options = {
            hostname: JSEARCH_BASE_URL,
            path: `/search?${params.toString()}`,
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': JSEARCH_API_KEY,
                'X-RapidAPI-Host': JSEARCH_BASE_URL
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData.data || []);
                } catch (error) {
                    console.error(`Error parsing JSON for query "${query}":`, error.message);
                    resolve([]);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Request failed for query "${query}":`, error.message);
            resolve([]);
        });

        req.setTimeout(15000, () => {
            req.destroy();
            console.error(`Request timeout for query "${query}"`);
            resolve([]);
        });

        req.end();
    });
}

/**
 * Fetch all jobs from JSearch with rate limiting
 */
async function fetchAllJSearchJobs() {
    if (!JSEARCH_API_KEY) {
        console.error('❌ JSEARCH_API_KEY environment variable not set');
        return [];
    }

    // Load usage tracking
    const usage = loadUsageTracking();

    // Check rate limit
    if (usage.requests >= MAX_REQUESTS_PER_DAY) {
        console.log(`⏸️ JSearch daily limit reached (${usage.requests}/${MAX_REQUESTS_PER_DAY}), skipping this run`);
        return [];
    }

    // Log available quota
    console.log(`📊 JSearch quota: ${usage.remaining}/${MAX_REQUESTS_PER_DAY} requests remaining`);

    try {
        // Rotate queries based on current hour (spreads requests across queries)
        const currentHour = new Date().getUTCHours();
        const queryIndex = currentHour % SEARCH_QUERIES.length;
        const query = SEARCH_QUERIES[queryIndex];

        console.log(`📡 JSearch API - Query: "${query}" (${usage.requests + 1}/${MAX_REQUESTS_PER_DAY} today)`);

        const jobs = await fetchFromJSearch(query);

        // Update usage tracking
        usage.requests++;
        usage.remaining = MAX_REQUESTS_PER_DAY - usage.requests;
        usage.queries_executed.push(query);

        saveUsageTracking(usage);

        console.log(`✅ JSearch returned ${jobs.length} jobs`);
        console.log(`📊 Usage: ${usage.requests}/${MAX_REQUESTS_PER_DAY} requests, ${usage.remaining} remaining`);

        return jobs;

    } catch (error) {
        console.error('❌ JSearch API error:', error.message);
        return [];
    }
}

module.exports = {
    fetchAllJSearchJobs,
    SEARCH_QUERIES
};
