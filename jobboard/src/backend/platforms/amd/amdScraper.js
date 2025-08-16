const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: 'Unknown', state: 'US' };
  }
  const cleanLocation = locationText.replace(/\s+/g, ' ').trim();
  if (cleanLocation.includes(',')) {
    const parts = cleanLocation.split(',').map(p => p.trim());
    return { city: parts[0], state: parts[1] || 'US' };
  }
  return { city: cleanLocation, state: 'US' };
}

async function amdScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-css',
      '--disable-images',
      '--disable-plugins',
      '--disable-extensions',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache'
  });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() === 'stylesheet' || req.resourceType() === 'image') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  const allJobs = [];
  const baseUrl = 'https://careers.amd.com/careers-home/jobs';

  try {
    console.log('Scraping AMD careers page...');
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`\n--- Scraping Page ${pageNum} ---`);
      
      const searchUrl = `${baseUrl}?keywords=${encodeURIComponent(searchQuery)}&stretchUnit=MILES&stretch=10&location=United%20States&woe=12&regionCode=US&page=${pageNum}`;
      console.log(`Navigating to: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for job listings to load - using a more flexible selector
      try {
        await page.waitForSelector('mat-expansion-panel.search-result-item', { timeout: 30000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }
      
      // Scroll to bottom to ensure all jobs load
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for dynamic content
      
      // Check if job panels exist with debugging
      const hasJobPanels = await page.$('mat-expansion-panel.search-result-item');
      console.log(`Page contains job panels: ${!!hasJobPanels}`);
      
      // Get all job panel elements using a more flexible selector
      const jobPanels = await page.$$('mat-expansion-panel.search-result-item');
      console.log(`Found ${jobPanels.length} job panels on page ${pageNum}`);
      
      if (jobPanels.length === 0) {
        console.log(`No job panels on page ${pageNum}, stopping...`);
        break;
      }
      
      // Extract job data from each panel
      for (let i = 0; i < jobPanels.length; i++) {
        const panel = jobPanels[i];
        try {
          const jobData = await panel.evaluate((node, index) => {
            // Extract job title from the span with itemprop="title"
            const titleElement = node.querySelector('span[itemprop="title"]');
            const title = titleElement ? titleElement.textContent.trim() : '';
            
            // Extract location from span.label-value.location
            const locationElement = node.querySelector('span.label-value.location');
            const location = locationElement ? locationElement.textContent.trim() : '';
            
            // Extract apply link using the exact ID pattern: link-apply-{index}
            const linkElement = node.querySelector(`a#link-apply-${index}`);
            const applyLink = linkElement ? linkElement.getAttribute('href') : '';
            
            // Extract job ID from the req ID span
            const reqIdElement = node.querySelector('p.req-id span');
            const reqId = reqIdElement ? reqIdElement.textContent.trim() : '';
            
            // Extract categories
            const categoryElement = node.querySelector('span.categories.label-value');
            const category = categoryElement ? categoryElement.textContent.trim() : '';
            
            return {
              title,
              location,
              applyLink,
              reqId,
              category,
              posted: 'Recently'
            };
          }, i); // Pass index to the evaluate function
          
          if (!jobData || !jobData.title) continue;
          
          const { city, state } = parseLocation(jobData.location);
          // The apply link is already absolute from the HTML
          const applyLink = jobData.applyLink || '';
          
          const formattedJob = {
            employer_name: 'AMD',
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: jobData.posted,
            job_description: `${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: applyLink,
          };
          
          allJobs.push(formattedJob);
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location}`);
          
        } catch (error) {
          console.error(`Error extracting job data from panel ${i}:`, error);
          continue;
        }
      }
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
  
  console.log(`\nScraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  try {
    const searchQuery = process.argv.slice(2).join(' ') || 'hardware engineering';
    const maxPagesArg = process.argv.find(arg => arg.startsWith('--max-pages='));
    const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1]) : 10;
    
    console.log(`=== Scraping AMD Careers for: "${searchQuery}" with max ${maxPages} pages ===`);
    const jobs = await amdScraper(searchQuery, maxPages);
    console.log(`\n🎉 AMD Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);
    
    if (jobs.length > 0) {
      console.log('\n📋 All Scraped Jobs:');
      console.log('='.repeat(80));
      
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
        console.log(`   Description: ${job.job_description.substring(0, 100)}...`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found`);
      
      console.log('\n🔧 JSON Format (first 2 jobs):');
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log('❌ No jobs found for the search query.');
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Export the scraper function
module.exports = amdScraper;

// Run if this file is executed directly
if (require.main === module) {
  main();
}