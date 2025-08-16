const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  
  // Remove common prefixes and suffixes
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
  
  // Clean up the location text and parse different formats
  const cleanLocation = locationText.replace(/,?\s*United States$/i, '').trim();
  
  if (!cleanLocation) {
    return { city: '', state: 'United States' };
  }
  
  // Split by comma and trim
  const parts = cleanLocation.split(',').map(part => part.trim());
  
  if (parts.length >= 2) {
    // Format: "Westborough, MA" or "City, State"
    return {
      city: parts[0],
      state: parts[1]
    };
  } else if (parts.length === 1) {
    // Could be just a state or just a city
    const singlePart = parts[0];
    
    // Common US state abbreviations
    const stateAbbreviations = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    
    if (stateAbbreviations.includes(singlePart.toUpperCase())) {
      return { city: '', state: singlePart.toUpperCase() };
    } else {
      return { city: singlePart, state: '' };
    }
  }
  
  return { city: '', state: '' };
}

// Helper function to convert date to relative forma

async function intelScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for production
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-images', // Disable images for optimization
      '--disable-javascript', // Keep JS enabled for interactions
      '--disable-plugins',
      '--disable-extensions',
       
      
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-web-security",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection"
    ]
  });

  const page = await browser.newPage();
  
  // Disable CSS and images for optimization
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (resourceType === 'stylesheet' || resourceType === 'image' || resourceType === 'font') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  // Set user agent to avoid blocking
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const allJobs = [];
  const baseUrl = 'https://intel.wd1.myworkdayjobs.com';
  
  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`Scraping page ${pageNum}...`);
      
      // Construct URL with search query
      const searchUrl = `${baseUrl}/External?q=${encodeURIComponent(searchQuery)}&locations=1e4a4eb3adf101b8aec18a77bf810dd0&locations=1e4a4eb3adf1018c4bf78f77bf8112d0&locations=1e4a4eb3adf10118b1dfe877bf8162d0&locations=da6b8032b879100204a63a809f6c0000&locations=1e4a4eb3adf10146fd5c5276bf81eece&locations=1e4a4eb3adf1011246675c76bf81f8ce&locations=0741efd9f02e01994a3c9ca2ae078199&locations=1e4a4eb3adf1016541777876bf8111cf&locations=1e4a4eb3adf101fa2a777d76bf8116cf&locations=1e4a4eb3adf10174f0548376bf811bcf`;
      
      if (pageNum === 1) {
        console.log(`Searching for: "${searchQuery}"`);
        console.log(`Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 600000 });
      }
      
      // Wait for job listings to load
      try {
        await page.waitForSelector('li.css-1q2dra3', { timeout: 100000 });
      } catch (error) {
        console.log(`No jobs found on page ${pageNum}, stopping...`);
        break;
      }
      
      // Scroll to bottom to load all jobs on current page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get all job list items
      const jobItems = await page.$$('li.css-1q2dra3');
      
      if (jobItems.length === 0) {
        console.log(`No job items found on page ${pageNum}, stopping...`);
        break;
      }
      
      console.log(`Found ${jobItems.length} potential job items on page ${pageNum}`);
      
      // Extract job data from each list item
      for (const jobItem of jobItems) {
        try {
          const jobData = await jobItem.evaluate((item) => {
            // Extract title from h3
            const titleElement = item.querySelector('h3');
            const title = titleElement ? titleElement.textContent.trim() : '';
            
            // Extract apply link from a tag
            const linkElement = item.querySelector('a');
            const applyLink = linkElement ? linkElement.getAttribute('href') : '';
            
            // Extract location and posted date from dd.css-129m7dg elements
            const ddElements = item.querySelectorAll('dd.css-129m7dg');
            let location = '';
            let posted = '';
            
            if (ddElements.length >= 2) {
              location = ddElements[0] ? ddElements[0].textContent.trim() : '';
              posted = ddElements[1] ? ddElements[1].textContent.trim() : '';
            } else if (ddElements.length === 1) {
              location = ddElements[0] ? ddElements[0].textContent.trim() : '';
            }
            
            return {
              title,
              applyLink,
              location,
              posted
            };
          });
          
          // Skip if no job data found
          if (!jobData || !jobData.title) continue;
          
          // Parse location
          const { city, state } = parseLocation(jobData.location);
          
          // Construct full apply link
          const applyLink = jobData.applyLink ? 
            (jobData.applyLink.startsWith('http') ? jobData.applyLink : `${baseUrl}${jobData.applyLink}`) 
            : '';
          
          // Format the job data
          const formattedJob = {
            employer_name: "INTEL",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at:jobData.posted,
            job_description:`${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
            job_apply_link: applyLink
          };
          
          allJobs.push(formattedJob);
          console.log(`✓ Scraped: ${jobData.title} at ${jobData.location}`);
          
        } catch (error) {
          console.error('Error extracting job data from item:', error);
          continue;
        }
      }
      
      // Check if we've reached the last page or need to navigate to next page
      if (pageNum < maxPages) {
        console.log(`Looking for next page button...`);
        
        // Look for the next page button (chevron right)
        try {
          const nextButton = await page.$('svg.wd-icon-chevron-right-small.wd-icon');
          
          if (nextButton) {
            // Check if the button is clickable (not disabled)
            const isClickable = await page.evaluate((button) => {
              const parentButton = button.closest('button');
              return parentButton && !parentButton.disabled && !parentButton.getAttribute('aria-disabled');
            }, nextButton);
            
            if (isClickable) {
              console.log(`Clicking next page button for page ${pageNum + 1}...`);
              await nextButton.click();
              
              // Wait for new page to load
              await new Promise(resolve => setTimeout(resolve, 3000));
              await page.waitForSelector('li.css-1q2dra3', { timeout: 10000 });
            } else {
              console.log('Next page button is disabled, reached last page');
              break;
            }
          } else {
            console.log('No next page button found, reached last page');
            break;
          }
        } catch (error) {
          console.log('Error navigating to next page:', error.message);
          break;
        }
      }
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
  
  console.log(`\n INTEL Scraping completed! Found ${allJobs.length} total jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  try {
    // Get search query from command line arguments
    // If multiple arguments, join them with spaces
    const searchQuery = process.argv.slice(2).join(' ');
    
    if (!searchQuery) {
      console.log('Please provide a search query!');
      console.log('Usage: node intelScraper.js hardware engineering');
      console.log('Usage: node intelScraper.js software');
      console.log('Usage: node intelScraper.js "data science"');
      console.log('Or with quotes: node intelScraper.js "machine learning"');
      console.log('Note: maxPages parameter controls number of pages to scrape');
      return;
    }
    
    console.log(`=== Scraping INTEL Careers for: "${searchQuery}" (10 pages max) ===`);
    const jobs = await intelScraper(searchQuery, 10);
    console.log(`\n🎉 Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);
    
    // Display all scraped jobs
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
      
      // Also show JSON format for first 2 jobs
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
module.exports = intelScraper;

// Run if this file is executed directly
if (require.main === module) {
  main();
}