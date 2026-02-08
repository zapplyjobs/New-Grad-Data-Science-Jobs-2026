#!/usr/bin/env node

/**
 * Job Processor for Data Science Jobs
 *
 * Handles deduplication, senior filtering, 14-day TTL, and US-only filtering
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate unique job ID from JSearch job data
 */
function generateJobId(job) {
    const jobUrl = job.job_apply_link;

    if (jobUrl) {
        try {
            const urlObj = new URL(jobUrl);
            const normalized = urlObj.hostname + urlObj.pathname.replace(/\/$/, '');
            return normalized.toLowerCase().replace(/[^\w]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        } catch (e) {
            // Invalid URL, fall through to fallback
        }
    }

    // Fallback: company-title-location
    const company = (job.employer_name || '').toLowerCase().replace(/\s+/g, '-');
    const title = (job.job_title || '').toLowerCase().replace(/\s+/g, '-');
    const location = (job.job_city || '').toLowerCase().replace(/\s+/g, '-');
    return `${company}-${title}-${location}`.replace(/[^\w-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate job fingerprint for duplicate detection
 */
function generateJobFingerprint(job) {
    const title = (job.job_title || '').toLowerCase()
        .replace(/\b(senior|sr\.?|junior|jr\.?|staff|principal|lead|associate)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const company = (job.employer_name || '').toLowerCase()
        .replace(/\s+(inc\.?|llc|corp\.?|ltd\.?)$/i, '')
        .trim();

    const location = (job.job_city || '').split(',')[0].toLowerCase().trim();

    return `${company}::${title}::${location}`;
}

/**
 * Check if job is senior level (should be filtered out)
 */
function isSeniorJob(job) {
    const text = `${job.job_title || ''} ${job.job_description || ''}`.toLowerCase();

    const seniorKeywords = [
        'senior', 'sr.', 'staff', 'principal', 'lead',
        'architect', 'manager', 'director', 'vp', 'head of'
    ];

    // Check if it contains senior keywords
    const hasSeniorKeyword = seniorKeywords.some(kw => text.includes(kw));

    // But allow if it also has entry-level indicators
    const entryLevelKeywords = [
        'entry level', 'junior', 'jr.', 'new grad', 'recent graduate',
        'associate', 'intern', 'campus', 'student', '0-2 years', 'early career'
    ];

    const hasEntryLevelKeyword = entryLevelKeywords.some(kw => text.includes(kw));

    // Filter if has senior keywords and NO entry-level indicators
    return hasSeniorKeyword && !hasEntryLevelKeyword;
}

/**
 * Check if job is US-only
 */
function isUSOnlyJob(job) {
    const country = (job.job_country || '').toLowerCase();
    const state = (job.job_state || '').toLowerCase();
    const city = (job.job_city || '').toLowerCase();

    // Explicit US indicators
    if (country === 'us' || country === 'usa' || country === 'united states') {
        return true;
    }

    // Non-US countries to exclude
    const nonUSCountries = [
        'canada', 'uk', 'united kingdom', 'germany', 'france',
        'netherlands', 'india', 'singapore', 'japan', 'australia'
    ];

    if (nonUSCountries.some(c => country.includes(c))) {
        return false;
    }

    // US state codes
    const usStates = [
        'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
        'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
        'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
        'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
        'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy', 'dc'
    ];

    if (usStates.includes(state)) {
        return true;
    }

    // Remote jobs - assume US unless specified otherwise
    if (city.includes('remote') && !country) {
        return true;
    }

    return false;
}

/**
 * Check if job is older than 14 days
 */
function isJobOlderThan14Days(job) {
    const postedDate = job.job_posted_at_datetime_utc;
    if (!postedDate) return false;

    const jobDate = new Date(postedDate);
    const now = new Date();
    const diffInDays = Math.floor((now - jobDate) / (1000 * 60 * 60 * 24));

    return diffInDays >= 14;
}

/**
 * Load seen jobs from store
 */
function loadSeenJobsStore() {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    const seenPath = path.join(dataDir, 'seen_jobs.json');

    try {
        if (!fs.existsSync(seenPath)) {
            return new Set();
        }

        const data = JSON.parse(fs.readFileSync(seenPath, 'utf8'));
        const seenSet = new Set();

        if (Array.isArray(data)) {
            data.forEach(id => seenSet.add(id));
        } else {
            Object.keys(data).forEach(id => seenSet.add(id));
        }

        return seenSet;
    } catch (error) {
        console.error('Error loading seen jobs:', error.message);
        return new Set();
    }
}

/**
 * Save seen jobs to store
 */
function saveSeenJobsStore(seenJobs) {
    const dataDir = path.join(process.cwd(), '.github', 'data');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const seenPath = path.join(dataDir, 'seen_jobs.json');
    const tempPath = path.join(dataDir, 'seen_jobs.tmp.json');

    const data = Array.from(seenJobs);

    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, seenPath);
}

/**
 * Load current jobs store
 */
function loadCurrentJobsStore() {
    const dataDir = path.join(process.cwd(), '.github', 'data');
    const currentPath = path.join(dataDir, 'current_jobs.json');

    try {
        if (!fs.existsSync(currentPath)) {
            return [];
        }

        const data = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
        return data || [];
    } catch (error) {
        console.error('Error loading current jobs:', error.message);
        return [];
    }
}

/**
 * Save current jobs store
 */
function saveCurrentJobsStore(jobs) {
    const dataDir = path.join(process.cwd(), '.github', 'data');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const currentPath = path.join(dataDir, 'current_jobs.json');
    const tempPath = path.join(dataDir, 'current_jobs.tmp.json');

    fs.writeFileSync(tempPath, JSON.stringify(jobs, null, 2), 'utf8');
    fs.renameSync(tempPath, currentPath);
}

/**
 * Merge persisted jobs with fresh jobs
 */
function mergeJobs(persistedJobs, freshJobs) {
    const jobMap = new Map();

    persistedJobs.forEach(job => {
        if (job.id) {
            jobMap.set(job.id, job);
        }
    });

    freshJobs.forEach(job => {
        if (job.id) {
            jobMap.set(job.id, job);
        }
    });

    return Array.from(jobMap.values());
}

/**
 * Process jobs from JSearch API
 */
async function processJobs(jobs) {
    console.log('🔧 Processing jobs...');

    // Add unique IDs
    jobs.forEach(job => {
        job.id = generateJobId(job);
    });

    // Load persisted jobs
    const persistedJobs = loadCurrentJobsStore();
    console.log(`📦 Loaded ${persistedJobs.length} persisted jobs`);

    // Merge with fresh jobs
    const mergedJobs = mergeJobs(persistedJobs, jobs);
    console.log(`📊 Merged to ${mergedJobs.length} unique jobs`);

    // Filter to US-only
    const usJobs = mergedJobs.filter(job => isUSOnlyJob(job));
    console.log(`🇺🇸 Filtered to ${usJobs.length} US-only jobs`);

    // Filter out senior jobs
    const nonSeniorJobs = usJobs.filter(job => !isSeniorJob(job));
    console.log(`🎓 Filtered out ${usJobs.length - nonSeniorJobs.length} senior jobs`);

    // Filter by age (keep jobs < 14 days)
    const currentJobs = nonSeniorJobs.filter(job => !isJobOlderThan14Days(job));
    console.log(`📅 Filtered to ${currentJobs.length} current jobs (< 14 days old)`);

    // Save current jobs
    saveCurrentJobsStore(currentJobs);

    // Calculate archived jobs
    const archivedJobs = nonSeniorJobs.filter(job => isJobOlderThan14Days(job));

    return {
        currentJobs,
        archivedJobs
    };
}

module.exports = {
    generateJobId,
    generateJobFingerprint,
    isSeniorJob,
    isUSOnlyJob,
    isJobOlderThan14Days,
    loadSeenJobsStore,
    saveSeenJobsStore,
    loadCurrentJobsStore,
    saveCurrentJobsStore,
    mergeJobs,
    processJobs
};
