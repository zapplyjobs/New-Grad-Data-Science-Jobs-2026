const fs = require("fs");
const { generateJobId } = require("./job-fetcher/utils");
const scrapeAmazonJobs = require("../../jobboard/src/backend/platforms/amazon/amazonScraper");
const googleScraper = require("../../jobboard/src/backend/platforms/google/googleScraper");
const scrapeMetaJobs = require("../../jobboard/src/backend/platforms/meta/metaScraper");
const microsoftScraper = require("../../jobboard/src/backend/platforms/microsoft/microsoftScraper");
const armScraper = require("../../jobboard/src/backend/platforms/arm/armScraper");
const micronScraper = require("../../jobboard/src/backend/platforms/micron/micronScraper");
const ibmScraper = require("../../jobboard/src/backend/platforms/ibm/ibmScraper");

const abbScraper = require("../../jobboard/src/backend/platforms/abb/abbScraper");
const infineonScraper = require("../../jobboard/src/backend/platforms/infineon/infineonScraper");
const texasScraper = require("../../jobboard/src/backend/platforms/texas/texasScraper");
const ciscoScraper = require("../../jobboard/src/backend/platforms/cisco/ciscoScraper");
const siemensScraper = require("../../jobboard/src/backend/platforms/siemen/siemensScraper");
const analogScraper = require("../../jobboard/src/backend/platforms/analog/analogScraper");
const MarvelScraper = require("../../jobboard/src/backend/platforms/marvel/marvelScraper");
const aijobsScraper = require("../../jobboard/src/backend/platforms/ai/aijobsScraper");
const waymoScraper = require("../../jobboard/src/backend/platforms/waymo/waymoScraper");
const illuminaScraper = require("../../jobboard/src/backend/platforms/illumina/illuminaScraper");
const synopsysScraper = require("../../jobboard/src/backend/platforms/synopsys/synopsysScraper");
const appliedMaterialsScraper = require("../../jobboard/src/backend/platforms/appliedMaterials/appliedMaterialsScraper");
const genomicsScraper = require("../../jobboard/src/backend/platforms/genomics/genomicsScraper");
const rivianScraper = require("../../jobboard/src/backend/platforms/rivian/rivianScraper");
const jpmcScraper = require("../../jobboard/src/backend/platforms/jpmc/jpmcScraper");
const honeywellScraper = require("../../jobboard/src/backend/platforms/honeywell/honeywellScraper");
const amdScraper = require("../../jobboard/src/backend/platforms/amd/amdScraper");
const nvidiaScraper = require("../../jobboard/src/backend/platforms/nvidia/nvidiaScraper");
const appleScraper = require("../../jobboard/src/backend/platforms/apple/appleScraper");
const intelScraper = require("../../jobboard/src/backend/platforms/intel/intelScraper");
const adobeScraper = require("../../jobboard/src/backend/platforms/adobe/adobeScraper");
const boozallenScraper = require("../../jobboard/src/backend/platforms/boozallen/boozallenScraper");
const broadcomScraper = require("../../jobboard/src/backend/platforms/broadcom/broadcomScraper");
const dellScraper = require("../../jobboard/src/backend/platforms/dell/dellScraper");
const gditScraper = require("../../jobboard/src/backend/platforms/gdit/gditScraper");
const guidehouseScraper = require("../../jobboard/src/backend/platforms/guidehouse/guidehouseScraper");
const hpeScraper = require("../../jobboard/src/backend/platforms/hpe/hpeScraper");
const magnaScraper = require("../../jobboard/src/backend/platforms/magna/magnaScraper");
const salesforceScraper = require("../../jobboard/src/backend/platforms/salesforce/salesforceScraper");
const verizonScraper = require("../../jobboard/src/backend/platforms/verizon/verizonScraper");
const workdayScraper = require("../../jobboard/src/backend/platforms/workday/workdayScraper");

// Batch processing configuration
const BATCH_CONFIG = {
  batchSize: 8,                    // Number of scrapers to run concurrently in each batch (8 companies)
  delayBetweenBatches: 2000,       // Delay in milliseconds between batches (2 seconds)
  maxRetries: 3,                   // Maximum retry attempts for failed scrapers
  timeout: 180000,                 // Timeout for individual scrapers (3 minutes)
  enableProgressBar: true,          // Enable progress tracking
  enableDetailedLogging: true      // Enable detailed logging for each scraper
};

// Predefined batch configurations for different scenarios
const BATCH_PRESETS = {
  // Fast mode - more concurrent scrapers, shorter delays
  fast: {
    ...BATCH_CONFIG,
    batchSize: 10,
    delayBetweenBatches: 1500,
    maxRetries: 2,
    timeout: 120000
  },
  
  // Conservative mode - fewer concurrent scrapers, longer delays
  conservative: {
    ...BATCH_CONFIG,
    batchSize: 5,
    delayBetweenBatches: 4000,
    maxRetries: 4,
    timeout: 240000
  },
  
  // Debug mode - detailed logging, smaller batches
  debug: {
    ...BATCH_CONFIG,
    batchSize: 3,
    delayBetweenBatches: 3000,
    maxRetries: 3,
    timeout: 300000,
    enableDetailedLogging: true
  }
};

// Function to create custom batch configuration
function createBatchConfig(options = {}) {
  return {
    ...BATCH_CONFIG,
    ...options
  };
}

// Load company database
const companies = JSON.parse(
  fs.readFileSync("./.github/scripts/job-fetcher/companies.json", "utf8")
);
const ALL_COMPANIES = Object.values(companies).flat();

// Real career page endpoints for major companies
const CAREER_APIS = {
  // Greenhouse API Companies
  Stripe: {
    api: "https://api.greenhouse.io/v1/boards/stripe/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Stripe",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description:
            job.content ||
            "Join Stripe to help build the economic infrastructure for the internet.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  Coinbase: {
    api: "https://api.greenhouse.io/v1/boards/coinbase/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Coinbase",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description:
            job.content ||
            "Join Coinbase to build the future of cryptocurrency.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  Airbnb: {
    api: "https://api.greenhouse.io/v1/boards/airbnb/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Airbnb",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description:
            job.content ||
            "Join Airbnb to create a world where anyone can belong anywhere.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  Databricks: {
    api: "https://api.greenhouse.io/v1/boards/databricks/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Databricks",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description:
            job.content || "Join Databricks to unify analytics and AI.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  Figma: {
    api: "https://api.greenhouse.io/v1/boards/figma/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Figma",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description:
            job.content || "Join Figma to make design accessible to all.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  // Custom API Companies
  Apple: {
    api: "https://jobs.apple.com/api/v1/search",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "engineer",
      filters: {
        locations: ["postLocation-USA"],
      },
      page: 1,
      locale: "en-us",
      sort: "newest",
      format: {
        longDate: "MMMM D, YYYY",
        mediumDate: "MMM D, YYYY",
      },
    }),
    parser: (data) => {
      if (!data.searchResults) return [];
      return data.searchResults.slice(0, 20).map((job) => ({
        job_title: job.postingTitle,
        employer_name: "Apple",
        job_city: job.locations?.[0]?.name?.split(", ")?.[0] || "Cupertino",
        job_state: job.locations?.[0]?.name?.split(", ")?.[1] || "CA",
        job_description:
          job.jobSummary || "Join Apple to create products that change lives.",
        job_apply_link: `https://jobs.apple.com/en-us/details/${job.positionId}`,
        job_posted_at_datetime_utc: safeISOString(job.postDateInGMT),
        job_employment_type: "FULLTIME",
      }));
    },
  },

  Microsoft: {
    api: "https://gcsservices.careers.microsoft.com/search/api/v1/search?l=en_us&pg=1&pgSz=20&o=Recent&flt=true",
    method: "GET",
    parser: (data) => {
      if (!data.operationResult?.result?.jobs) return [];
      return data.operationResult.result.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Microsoft",
          job_city: job.primaryLocation?.city || "Redmond",
          job_state: job.primaryLocation?.state || "WA",
          job_description:
            job.description ||
            "Join Microsoft to empower every person and organization on the planet.",
          job_apply_link: `https://jobs.careers.microsoft.com/global/en/job/${job.jobId}`,
          job_posted_at_datetime_utc: safeISOString(job.postedDate),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  // Amazon now uses dedicated scraper

  Netflix: {
    api: "https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&query=engineer",
    method: "GET",
    pagination: true,
    parser: (data) => {
      if (!data.positions) return [];

      // Filter for fresh jobs from past week and engineering roles
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      return data.positions
        .filter((job) => {
          const isEngineering =
            job.name.toLowerCase().includes("engineer") ||
            job.name.toLowerCase().includes("developer") ||
            job.department === "Engineering";
          const isFresh = job.t_create * 1000 > oneWeekAgo;
          return isEngineering && isFresh;
        })
        .map((job) => ({
          job_title: job.name,
          employer_name: "Netflix",
          job_city: job.location?.split(",")?.[0] || "Los Gatos",
          job_state: job.location?.split(", ")?.[1] || "CA",
          job_description:
            job.job_description || "Join Netflix to entertain the world.",
          job_apply_link: job.canonicalPositionUrl,
          job_posted_at_datetime_utc: safeISOString(job.t_create * 1000),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  Qualcomm: {
    api: "https://careers.qualcomm.com/api/apply/v2/jobs?domain=qualcomm.com&num=20&query=USA&sort_by=relevance",
    method: "GET",
    parser: (data) => {
      if (!data.positions) return [];
      return data.positions
        .filter(
          (job) =>
            job.name.toLowerCase().includes("engineer") ||
            job.name.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.name,
          employer_name: "Qualcomm",
          job_city: job.location?.split(", ")?.[0] || "San Diego",
          job_state: job.location?.split(", ")?.[1] || "CA",
          job_description:
            job.description ||
            "Join Qualcomm to invent breakthrough technologies.",
          job_apply_link: job.canonicalPositionUrl,
          job_posted_at_datetime_utc: safeISOString(job.publishedDate),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  PayPal: {
    api: "https://paypal.eightfold.ai/api/apply/v2/jobs?domain=paypal.com&num=20&location=USA&sort_by=relevance",
    method: "GET",
    parser: (data) => {
      if (!data.positions) return [];
      return data.positions
        .filter(
          (job) =>
            job.name.toLowerCase().includes("engineer") ||
            job.name.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.name,
          employer_name: "PayPal",
          job_city: job.location?.split(", ")?.[0] || "San Jose",
          job_state: job.location?.split(", ")?.[1] || "CA",
          job_description:
            job.description || "Join PayPal to democratize financial services.",
          job_apply_link: job.canonicalPositionUrl,
          job_posted_at_datetime_utc: safeISOString(job.publishedDate),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  // Lever API Companies
  // Uber now uses dedicated scraper

  Discord: {
    api: "https://boards-api.greenhouse.io/v1/boards/discord/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Discord",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description: job.content || "Join Discord to build connections.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  Lyft: {
    api: "https://boards-api.greenhouse.io/v1/boards/lyft/jobs",
    method: "GET",
    parser: (data) => {
      if (!Array.isArray(data.jobs)) return [];
      return data.jobs
        .filter(
          (job) =>
            job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer")
        )
        .map((job) => ({
          job_title: job.title,
          employer_name: "Lyft",
          job_city: job.location?.name?.split(", ")?.[0] || "San Francisco",
          job_state: job.location?.name?.split(", ")?.[1] || "CA",
          job_description:
            job.content ||
            "Join Lyft to improve people's lives with the world's best transportation.",
          job_apply_link: job.absolute_url,
          job_posted_at_datetime_utc: safeISOString(job.updated_at),
          job_employment_type: "FULLTIME",
        }));
    },
  },

  // Slack now uses dedicated scraper
};

// Utility functions
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeISOString(dateValue) {
  if (!dateValue) return new Date().toISOString();

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

// Fetch jobs from a specific company's career API
async function fetchCompanyJobs(companyName) {
  const config = CAREER_APIS[companyName];
  if (!config) {
    console.log(`⚠️ No API config for ${companyName}`);
    return [];
  }

  try {
    console.log(`🔍 Fetching jobs from ${companyName}...`);

    const options = {
      method: config.method,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        ...config.headers,
      },
    };

    if (config.body) {
      options.body = config.body;
    }

    const response = await fetch(config.api, options);

    if (!response.ok) {
      console.log(`❌ ${companyName} API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const jobs = config.parser(data);

    console.log(`✅ Found ${jobs.length} jobs at ${companyName}`);
    return jobs;
  } catch (error) {
    console.error(`❌ Error fetching ${companyName} jobs:`, error.message);
    return [];
  }
}

// No sample jobs - only real API data

// Fetch jobs from SimplifyJobs public data
async function fetchSimplifyJobsData() {
  try {
    console.log("📡 Fetching data from public sources...");

    const newGradUrl =
      "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json";
    const response = await fetch(newGradUrl);

    if (!response.ok) {
      console.log(`⚠️ Could not fetch external data: ${response.status}`);
      return [];
    }

    const data = await response.json();

    const activeJobs = data
      .filter(
        (job) =>
          job.active &&
          job.url &&
          (job.title.toLowerCase().includes("engineer") ||
            job.title.toLowerCase().includes("developer"))
      )
      .map((job) => ({
        job_title: job.title,
        employer_name: job.company_name,
        job_city: job.locations?.[0]?.split(", ")?.[0] || "Multiple",
        job_state: job.locations?.[0]?.split(", ")?.[1] || "Locations",
        job_description: `Join ${job.company_name} in this exciting opportunity.`,
        job_apply_link: job.url,
        job_posted_at_datetime_utc: safeISOString(job.date_posted * 1000),
        job_employment_type: "FULLTIME",
      }));

    console.log(
      `📋 Found ${activeJobs.length} active positions from external sources`
    );
    return activeJobs;
  } catch (error) {
    console.error(`❌ Error fetching external data:`, error.message);
    return [];
  }
}

// Fetch jobs from all companies with real career APIs
async function fetchAllRealJobs() {
  console.log("🚀 Starting REAL career page scraping...");

  const allJobs = [];
  // Define scraper configurations for batch processing
  const scraperConfigs = [
    { name: 'Amazon', scraper: scrapeAmazonJobs, query: 'Data Science' },
    { name: 'Meta', scraper: scrapeMetaJobs, query: 'Data Science' },
    { name: 'Microsoft', scraper: microsoftScraper, query: 'data science' },
    { name: 'Google', scraper: googleScraper, query: 'Data Science' },
    { name: 'ARM', scraper: armScraper, query: 'Data Science' },
    { name: 'Micron', scraper: micronScraper, query: 'Data Science' },
    { name: 'IBM', scraper: ibmScraper, query: 'Data Science' },
    { name: 'ABB', scraper: abbScraper, query: 'Data Science' },
    { name: 'Infineon', scraper: infineonScraper, query: 'Data Science' },
    { name: 'Texas Instruments', scraper: texasScraper, query: 'Data Science' },
    { name: 'Cisco', scraper: ciscoScraper, query: 'Data Science' },
    { name: 'Siemens', scraper: siemensScraper, query: 'Data Science' },
    { name: 'Analog Devices', scraper: analogScraper, query: 'Data Science' },
    { name: 'Marvel', scraper: MarvelScraper, query: 'Data Science' },
    { name: 'AI Jobs', scraper: aijobsScraper, query: 'data science' },
    { name: 'Waymo', scraper: waymoScraper, query: 'Data Science' },
    { name: 'Applied Materials', scraper: appliedMaterialsScraper, query: 'Data Science' },
    { name: 'Synopsys', scraper: synopsysScraper, query: 'Data Science' },
    { name: 'Illumina', scraper: illuminaScraper, query: 'Data Science' },
    { name: 'Genomics', scraper: genomicsScraper, query: 'Data Science' },
    { name: 'Rivian', scraper: rivianScraper, query: 'Data Science' },
    { name: 'JPMorgan Chase', scraper: jpmcScraper, query: 'Data Science' },
    { name: 'Honeywell', scraper: honeywellScraper, query: 'Data Science' },
    { name: 'AMD', scraper: amdScraper, query: 'Data Science' },
    { name: 'NVIDIA', scraper: nvidiaScraper, query: 'Data Science' },
    { name: 'Apple', scraper: appleScraper, query: 'Data Science' },
    { name: 'Intel', scraper: intelScraper, query: 'Data Science' },
    { name: 'Booz Allen Hamilton', scraper: boozallenScraper, query: 'Data Science' },
    { name: 'Broadcom', scraper: broadcomScraper, query: 'Data Science' },
    { name: 'Dell', scraper: dellScraper, query: 'Data Science' },
    { name: 'GDIT', scraper: gditScraper, query: 'Data Science' },
    { name: 'Guidehouse', scraper: guidehouseScraper, query: 'Data Science' },
    { name: 'HPE', scraper: hpeScraper, query: 'Data Science' },
    { name: 'Magna', scraper: magnaScraper, query: 'Data Science' },
    { name: 'Salesforce', scraper: salesforceScraper, query: 'Data Science' },
    { name: 'Verizon', scraper: verizonScraper, query: 'Data Science' },
    { name: 'Workday', scraper: workdayScraper, query: 'Data Science' }
  ];

  // Enhanced batch processing function with retry logic and configuration
  async function processScrapersInBatches(configs, config = BATCH_CONFIG) {
    const results = [];
    const totalBatches = Math.ceil(configs.length / config.batchSize);
    
    console.log(`🚀 Starting optimized batch processing:`);
    console.log(`   📊 Total scrapers: ${configs.length}`);
    console.log(`   📦 Batch size: ${config.batchSize} (8 companies per batch)`);
    console.log(`   ⏱️  Total batches: ${totalBatches}`);
    console.log(`   ⏳ Delay between batches: ${config.delayBetweenBatches}ms`);
    console.log(`   🔄 Max retries: ${config.maxRetries}`);
    
    // Progress tracking
    let completedScrapers = 0;
    let successfulScrapers = 0;
    let failedScrapers = 0;
    
    for (let i = 0; i < configs.length; i += config.batchSize) {
      const batch = configs.slice(i, i + config.batchSize);
      const batchNumber = Math.floor(i / config.batchSize) + 1;
      
      console.log(`\n📦 Processing Batch ${batchNumber}/${totalBatches}: ${batch.map(c => c.name).join(', ')}`);
      
      // Process current batch concurrently with retry logic
      const batchPromises = batch.map(async (scraperConfig) => {
        let lastError = null;
        let startTime = Date.now(); // Declare startTime outside the loop
        
        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
          try {
            // Update startTime for each attempt
            startTime = Date.now();
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Scraper timeout')), config.timeout);
            });
            
            // Race between scraper and timeout
            const jobs = await Promise.race([
              scraperConfig.scraper(scraperConfig.query),
              timeoutPromise
            ]);
            
            const duration = Date.now() - startTime;
            completedScrapers++;
            successfulScrapers++;
            
            if (config.enableDetailedLogging) {
              console.log(`✅ ${scraperConfig.name}: ${jobs.length} jobs in ${duration}ms (Attempt ${attempt})`);
            }
            
            return { 
              name: scraperConfig.name, 
              jobs, 
              duration, 
              success: true, 
              attempts: attempt,
              error: null 
            };
            
          } catch (error) {
            lastError = error;
            if (config.enableDetailedLogging) {
              console.log(`⚠️  ${scraperConfig.name} attempt ${attempt} failed: ${error.message}`);
            }
            
            // If this is the last attempt, mark as failed
            if (attempt === config.maxRetries) {
              const duration = Date.now() - startTime;
              completedScrapers++;
              failedScrapers++;
              
              console.error(`❌ ${scraperConfig.name} failed after ${config.maxRetries} attempts: ${error.message}`);
              
              return { 
                name: scraperConfig.name, 
                jobs: [], 
                duration: duration, 
                success: false, 
                attempts: attempt,
                error: error.message 
              };
            }
            
            // Wait before retry (exponential backoff)
            const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            if (config.enableDetailedLogging) {
              console.log(`⏳ Retrying ${scraperConfig.name} in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        }
      });
      
      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Progress update
      const progress = ((completedScrapers / configs.length) * 100).toFixed(1);
      console.log(`📈 Progress: ${completedScrapers}/${configs.length} (${progress}%) - Success: ${successfulScrapers}, Failed: ${failedScrapers}`);
      
      // Add delay between batches (except for the last batch)
      if (i + config.batchSize < configs.length) {
        console.log(`⏳ Waiting ${config.delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
      }
    }
    
    return results;
  }

  // Process all scrapers in optimized batches
  // You can use different configurations:
  // - BATCH_CONFIG (default: 8 companies per batch, 2s delay)
  // - BATCH_PRESETS.fast (10 companies per batch, 1.5s delay)
  // - BATCH_PRESETS.conservative (5 companies per batch, 4s delay)
  // - BATCH_PRESETS.debug (3 companies per batch, 3s delay)
  // - createBatchConfig({ batchSize: 12, delayBetweenBatches: 1000 }) (custom)
  
  const batchResults = await processScrapersInBatches(scraperConfigs, BATCH_CONFIG);
  
  // Extract individual results for backward compatibility
  const [
    amazon_DataScience,
    meta_DataScience,
    microsoft_DataScience,
    google_DataScience,
    arm_DataScience,
    micron_DataScience,
    ibm_DataScience,
    abb_DataScience,
    infineon_DataScience,
    texas_DataScience,
    cisco_DataScience,
    siemens_DataScience,
    analog_DataScience,
    Marvel_DataScience,
    aijobs_DataScience,
    waymo_DataScience,
    appliedMaterials_DataScience,
    synopsys_DataScience,
    illumina_DataScience,
    genomics_DataScience,
    rivian_DataScience,
    jpmc_DataScience,
    honeywell_DataScience,
    amd_DataScience,  
    nvidia_DataScience,
    apple_DataScience,
    intel_DataScience,
    boozallen_DataScience,
    broadcom_DataScience,
    dell_DataScience,
    gdit_DataScience,
    guidehouse_DataScience,
    hpe_DataScience,
    magna_DataScience,
    salesforce_DataScience,
    verizon_DataScience,
    workday_DataScience,
  ] = batchResults.map(result => result.jobs);

  // Add all jobs to the results array
  allJobs.push(
    ...amazon_DataScience,
    ...meta_DataScience,
    ...microsoft_DataScience,
    ...google_DataScience,
    ...arm_DataScience,
    ...micron_DataScience,
    ...ibm_DataScience,
    ...abb_DataScience,
    ...infineon_DataScience,
    ...texas_DataScience,
    ...cisco_DataScience,
    ...siemens_DataScience,
    ...analog_DataScience,
    ...Marvel_DataScience,
    ...aijobs_DataScience,
    ...waymo_DataScience,
    ...appliedMaterials_DataScience,
    ...synopsys_DataScience,
    ...illumina_DataScience,
    ...genomics_DataScience,
    ...rivian_DataScience,
    ...jpmc_DataScience,
    ...honeywell_DataScience,
    ...amd_DataScience,
    ...nvidia_DataScience,
    ...apple_DataScience,
    ...intel_DataScience,
    ...boozallen_DataScience,
    ...broadcom_DataScience,
    ...dell_DataScience,
    ...gdit_DataScience,
    ...guidehouse_DataScience,
    ...hpe_DataScience,
    ...magna_DataScience,
    ...salesforce_DataScience,
    ...verizon_DataScience,
    ...workday_DataScience,
  );

  console.log(allJobs);

  const companiesWithAPIs = Object.keys(CAREER_APIS);

  // Fetch real jobs from companies with APIs
  // for (const company of companiesWithAPIs) {
  //     const jobs = await fetchCompanyJobs(company);
  //     allJobs.push(...jobs);

  //     // Be respectful with rate limiting
  //     await delay(2000);
  // }

  // Fetch jobs from external sources
  // const externalJobs = await fetchSimplifyJobsData();
  // allJobs.push(...externalJobs);

  // Remove duplicates using standardized job ID generation
  const uniqueJobs = allJobs.filter((job, index, self) => {
    const jobId = generateJobId(job);
    return index === self.findIndex((j) => generateJobId(j) === jobId);
  });

  // Sort by posting date (descending - latest first)
  uniqueJobs.sort((a, b) => {
    const dateA = new Date(a.job_posted_at_datetime_utc);
    const dateB = new Date(b.job_posted_at_datetime_utc);
    return dateB - dateA;
  });

  console.log(`📊 Total jobs collected: ${allJobs.length}`);
  console.log(`🧹 After deduplication: ${uniqueJobs.length}`);
  console.log(`🏢 Companies with real API data: ${companiesWithAPIs.length}`);
  //   console.log(`📡 External job sources: ${externalJobs.length}`);
  console.log(`✅ REAL JOBS ONLY - No fake data!`);

  return uniqueJobs;
}

module.exports = { fetchAllRealJobs };
