const puppeteer = require('puppeteer');

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/^(Senior|Staff|Principal|Lead|Jr|Junior)\s+/i, '')
    .replace(/\s+(I|II|III|IV|V|\d+)$/, '')
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, '')
    .replace(/Posted.*$/i, '')
    .trim();
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: "Pleasanton", state: "California" };
  }
  
  const cleanedLocation = locationText.replace(/\s+/g, ' ').trim();
  
  if (cleanedLocation.toLowerCase().includes('remote')) {
    return { city: "Remote", state: "California" };
  }
  
  const locationParts = cleanedLocation.split(',').map(part => part.trim());
  
  if (locationParts.length >= 2) {
    return { city: locationParts[0], state: locationParts[1] };
  } else {
    return { city: cleanedLocation || "Pleasanton", state: "California" };
  }
}

// Helper function to convert date to relative format
function convertDateToRelative(dateString) {
  if (!dateString) return "Recently";
  
  const cleanDate = dateString.replace(/Posted\s*/i, '').trim();
  
  if (cleanDate.includes('month')) {
    const months = cleanDate.match(/(\d+)\s*month/);
    return months ? `${months[1]} month${months[1] > 1 ? 's' : ''} ago` : "Recently";
  }
  
  if (cleanDate.includes('day')) {
    const days = cleanDate.match(/(\d+)\s*day/);
    return days ? `${days[1]} day${days[1] > 1 ? 's' : ''} ago` : "Recently";
  }
  
  if (cleanDate.includes('week')) {
    const weeks = cleanDate.match(/(\d+)\s*week/);
    return weeks ? `${weeks[1]} week${weeks[1] > 1 ? 's' : ''} ago` : "Recently";
  }
  
  return "Recently";
}

async function genomicsScraper(searchQuery, maxPages = 10) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  const allJobs = [];
  let currentPage = 0;

  try {
    console.log(`=== Scraping 10x Genomics for: "${searchQuery}" (up to ${maxPages} pages) ===`);

    while (currentPage < maxPages) {
      const start = currentPage * 10; // 10 jobs per page
      const searchUrl = `https://careers.10xgenomics.com/careers?query=${encodeURIComponent(searchQuery.replace(/ /g, '+'))}&start=${start}&location=united+states&sort_by=solr&filter_include_remote=1`;
      
      console.log(`\n--- Page ${currentPage + 1} (start=${start}) ---`);
      console.log(`URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for job listings
      try {
        await page.waitForSelector('[data-test-id="job-listing"]', { timeout: 10000 });
      } catch (error) {
        console.log(`No jobs found on page ${currentPage + 1}, stopping...`);
        break;
      }

      // Get all job elements
      const jobElements = await page.$$('[data-test-id="job-listing"]');
      
      if (jobElements.length === 0) {
        console.log(`No job elements found on page ${currentPage + 1}, stopping...`);
        break;
      }

      console.log(`Found ${jobElements.length} jobs on page ${currentPage + 1}`);

      // Extract job data
      for (let i = 0; i < jobElements.length; i++) {
        try {
          const jobData = await jobElements[i].evaluate(element => {
            // Extract job title - from the aria-label of the main link
            const titleElement = element.querySelector('a[aria-label]');
            const title = titleElement ? titleElement.getAttribute('aria-label').trim() : '';

            // Extract job link
            const linkElement = element.querySelector('a[href*="job"]') || 
                              element.querySelector('a');
            const href = linkElement ? linkElement.getAttribute('href') : '';

            // Extract location - look for text containing location info
            const locationElements = element.querySelector('div.fieldValue-3kEar');
            let location = '';

              const text = locationElements.textContent.trim();
             
                location = text;
             
              
            

            // Extract posted date - look for "Posted" text
            const dateElements = element.querySelectorAll('div');
            let postedDate = '';
            for (const div of dateElements) {
              const text = div.textContent.trim();
              if (text.toLowerCase().includes('posted') || text.includes('ago') || text.includes('month') || text.includes('day') || text.includes('week')) {
                postedDate = text;
                break;
              }
            }

            return {
              title: title,
              href: href,
              location: location,
              postedDate: postedDate
            };
          });

          if (!jobData.title || jobData.title.length < 3) {
            console.log(`  Skipping job ${i + 1}: No valid title`);
            continue;
          }

          // Parse location
          const { city, state } = parseLocation(jobData.location);

          // Build full apply link
          let fullApplyLink = jobData.href;
          if (fullApplyLink && !fullApplyLink.startsWith('http')) {
            fullApplyLink = `https://careers.10xgenomics.com${jobData.href}`;
          }

          // Convert posted date
          const relativePostedDate = convertDateToRelative(jobData.postedDate);

          const formattedJob = {
            employer_name: "10x Genomics",
            job_title: cleanJobTitle(jobData.title),
            job_city: city,
            job_state: state,
            job_posted_at: relativePostedDate,
            job_description: `${searchQuery} position at 10x Genomics - ${jobData.title}`,
            job_apply_link: fullApplyLink
          };

          allJobs.push(formattedJob);
          console.log(`  ✓ Job ${i + 1}: ${formattedJob.job_title} - ${city}, ${state} (${relativePostedDate})`);

        } catch (error) {
          console.error(`  Error extracting job ${i + 1}:`, error.message);
          continue;
        }
      }

      console.log(`✅ Page ${currentPage + 1} completed: ${jobElements.length} jobs processed`);

      // Simple pagination: if we got fewer than 10 jobs, we're probably at the end
      if (jobElements.length < 10) {
        console.log(`Found fewer than 10 jobs on page ${currentPage + 1}, likely at the end`);
        break;
      }

      // Move to next page
      currentPage++;
    }

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }

  console.log(`\n🎉 Scraping completed! Found ${allJobs.length} total jobs across ${currentPage + 1} pages.`);
  return allJobs;
}

// Main execution function
async function main() {
  try {
    const args = process.argv.slice(2);
    let searchQuery = "";
    let maxPages = 1;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--max-pages" || args[i] === "-m") {
        maxPages = parseInt(args[i + 1]) || 5;
        i++;
      } else {
        searchQuery += (searchQuery ? " " : "") + args[i];
      }
    }

    if (!searchQuery) {
      searchQuery = "software engineering";
    }

    console.log(`=== Scraping 10x Genomics Jobs for: "${searchQuery}" (up to ${maxPages} pages) ===`);
    const jobs = await genomicsScraper(searchQuery, maxPages);
    
    console.log(`\n🎉 Scraping completed! Found ${jobs.length} jobs for "${searchQuery}"`);

    if (jobs.length > 0) {
      console.log("\n📋 All Scraped Jobs:");
      console.log("=".repeat(80));

      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
      });

      console.log("\n" + "=".repeat(80));
      console.log(`📊 Summary: ${jobs.length} jobs found across all pages`);

      console.log("\n🔧 JSON Format (first 2 jobs):");
      console.log(JSON.stringify(jobs.slice(0, 2), null, 2));
    } else {
      console.log("❌ No jobs found for the search query.");
    }

  } catch (error) {
    console.error("Error in main:", error);
  }
}

module.exports = genomicsScraper;

if (require.main === module) {
  main();
}