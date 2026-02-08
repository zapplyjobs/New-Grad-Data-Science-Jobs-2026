#!/usr/bin/env node

/**
 * Utility functions for job processing
 */

/**
 * Format time ago for display
 */
function formatTimeAgo(dateString) {
    if (!dateString) return 'Recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else {
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays === 1) return '1d ago';
        if (diffInDays < 7) return `${diffInDays}d ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
        return `${Math.floor(diffInDays / 30)}mo ago`;
    }
}

/**
 * Format location for display
 */
function formatLocation(city, state, country) {
    if (!city && !state) return 'Remote';

    if (city && city.toLowerCase() === 'remote') return 'Remote 🏠';

    const parts = [];
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (country && country.toLowerCase() !== 'us') parts.push(country);

    return parts.join(', ');
}

/**
 * Get company emoji based on company name
 */
function getCompanyEmoji(companyName) {
    const company = (companyName || '').toLowerCase();

    const emojiMap = {
        'google': '🔍',
        'microsoft': '🪟',
        'amazon': '📦',
        'apple': '🍎',
        'meta': '👥',
        'facebook': '👥',
        'netflix': '🎬',
        'spotify': '🎵',
        'uber': '🚗',
        'airbnb': '🏠',
        'twitter': '🐦',
        'linkedin': '💼',
        'salesforce': '☁️',
        'oracle': '🔴',
        'ibm': '🔵',
        'adobe': '🅰️',
        'nvidia': '🟢',
        'intel': '💻',
        'amd': '🔶',
        'samsung': '📱',
        'sony': '📺'
    };

    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (company.includes(key)) {
            return emoji;
        }
    }

    return '🏢';
}

/**
 * Get job category based on title and description
 */
function getJobCategory(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('data scientist') || text.includes('data science')) {
        return 'Data Science';
    }
    if (text.includes('machine learning') || text.includes('ml ') || text.includes('deep learning')) {
        return 'Machine Learning';
    }
    if (text.includes('data analyst') || text.includes('analytics')) {
        return 'Data Analytics';
    }
    if (text.includes('data engineer')) {
        return 'Data Engineering';
    }
    if (text.includes('business analyst') || text.includes('business intelligence')) {
        return 'Business Intelligence';
    }
    if (text.includes('research scientist') || text.includes('research assistant')) {
        return 'Research';
    }

    return 'Data Science';
}

/**
 * Get experience level from title and description
 */
function getExperienceLevel(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();

    // Senior level indicators
    if (text.includes('senior') || text.includes('sr.') || text.includes('lead') ||
        text.includes('principal') || text.includes('staff') || text.includes('architect')) {
        return 'Senior';
    }

    // Entry level indicators
    if (text.includes('entry') || text.includes('junior') || text.includes('jr.') ||
        text.includes('new grad') || text.includes('graduate') || text.includes('university grad') ||
        text.includes('college grad') || text.includes(' grad ') || text.includes('recent grad') ||
        text.includes('intern') || text.includes('associate') || text.includes('level 1') ||
        text.includes('l1') || text.includes('campus') || text.includes('student') ||
        text.includes('early career') || text.includes('0-2 years')) {
        return 'Entry-Level';
    }

    return 'Mid-Level';
}

/**
 * Check if job is older than 14 days
 */
function isJobOlderThanWeek(dateString) {
    if (!dateString) return false;

    const match = String(dateString).match(/^(\d+)([hdwmo])$/i);
    if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'h': return value >= 336; // 14 days = 336 hours
            case 'd': return value >= 14;
            case 'w': return value >= 2;
            case 'mo': return true;
            default: return false;
        }
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;

    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    return diffInDays >= 14;
}

/**
 * Load company database
 */
const fs = require('fs');
const path = require('path');

let companies = {};
let ALL_COMPANIES = [];

try {
    const companiesPath = path.join(__dirname, 'companies.json');
    if (fs.existsSync(companiesPath)) {
        const companiesData = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));
        companies = companiesData;
        ALL_COMPANIES = Object.values(companiesData).flat();
    }
} catch (error) {
    console.warn('Could not load companies.json:', error.message);
}

/**
 * Get company career URL
 */
function getCompanyCareerUrl(companyName) {
    for (const category of Object.values(companies)) {
        for (const company of category) {
            if (company.name.toLowerCase() === companyName.toLowerCase()) {
                return company.career_url || '#';
            }
            for (const apiName of company.api_names || []) {
                if (apiName.toLowerCase() === companyName.toLowerCase()) {
                    return company.career_url || '#';
                }
            }
        }
    }
    return '#';
}

/**
 * Fetch internship data (simplified for SEO repos)
 */
async function fetchInternshipData() {
    return {
        sources: [],
        companyPrograms: [],
        lastUpdated: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    };
}

module.exports = {
    formatTimeAgo,
    formatLocation,
    getCompanyEmoji,
    getCompanyCareerUrl,
    getJobCategory,
    getExperienceLevel,
    isJobOlderThanWeek,
    fetchInternshipData,
    companies,
    ALL_COMPANIES
};
