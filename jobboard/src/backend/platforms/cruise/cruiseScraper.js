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

// Helper function to parse location and filter US jobs
function parseLocation(locationText) {
  if (!locationText || locationText.toLowerCase().includes('multiple')) {
    return { city: 'Multiple', state: 'Locations', country: 'US', isUS: true };
  }
  
  // Clean up the location text
  locationText = locationText.replace(/\s+/g, ' ').trim();
  
  const parts = locationText.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    const city = parts[0];
    const stateOrCountry = parts[1];
    
    // Check if it's a US state or US location
    const usStates = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'MI', 'GA', 'NC', 'NJ', 'VA', 'WA', 'MA', 'IN', 'AZ', 'TN', 'MO', 'MD', 'WI', 'MN', 'CO', 'AL', 'SC', 'LA', 'KY', 'OR', 'OK', 'CT', 'IA', 'MS', 'AR', 'KS', 'UT', 'NV', 'NM', 'WV', 'NE', 'ID', 'HI', 'NH', 'ME', 'RI', 'MT', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY', 'DC'];
    const usStateFull = ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Michigan', 'Georgia', 'North Carolina', 'New Jersey', 'Virginia', 'Washington', 'Massachusetts', 'Indiana', 'Arizona', 'Tennessee', 'Missouri', 'Maryland', 'Wisconsin', 'Minnesota', 'Colorado', 'Alabama', 'South Carolina', 'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Iowa', 'Mississippi', 'Arkansas', 'Kansas', 'Utah', 'Nevada', 'New Mexico', 'West Virginia', 'Nebraska', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Rhode Island', 'Montana', 'Delaware', 'South Dakota', 'North Dakota', 'Alaska', 'Vermont', 'Wyoming'];
    
    if (usStates.includes(stateOrCountry) || usStateFull.includes(stateOrCountry) || 
        stateOrCountry.toLowerCase().includes('us') || stateOrCountry.toLowerCase().includes('usa') ||
        stateOrCountry.toLowerCase().includes('united states')) {
      return { city, state: stateOrCountry, country: 'US', isUS: true };
    }
  }
  
  // Check for US indicators in the location text
  const locationLower = locationText.toLowerCase();
  if (locationLower.includes('usa') || locationLower.includes('united states') || 
      locationLower.includes('us only') || locationLower.includes('american') ||
      locationLower.includes('florida') || locationLower.includes('miami') ||
      locationLower.includes('caribbean') || locationLower.includes('bahamas')) {
    return { city: locationText, state: 'US', country: 'US', isUS: true };
  }
  
  return { city: locationText, state: 'International', country: 'Other', isUS: false };
}

async function cruiseJobsScraper(searchQuery, maxPages = 10, usOnly = true) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const allJobs = [];

  try {
    console.log(`Scraping All Cruise Jobs for: "${searchQuery}"`);
    if (usOnly) {
      console.log('Filtering for US-accessible jobs only');
    }

    // Try different URL patterns based on the screenshot
    const searchUrls = [
      `https://www.allcruisejobs.com/search/${encodeURIComponent(searchQuery.replace(/ /g, '+'))}/`,
      `https://www.allcruisejobs.com/browse/${encodeURIComponent(searchQuery)}/`,
      `https://www.allcruisejobs.com/search/?q=${encodeURIComponent(searchQuery)}`
    ];

    let foundJobs = false;
    
    for (const baseUrl of searchUrls) {
      if (foundJobs) break;
      
      console.log(`\nTrying URL pattern: ${baseUrl}`);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if we're on the right page
        const pageText = await page.evaluate(() => document.body.textContent);
        console.log('Page contains job content:', pageText.toLowerCase().includes('data'));

        // Try multiple selectors for job listings
        const possibleSelectors = [
          'article', // Common for job cards
          '.job-listing',
          '.job-item',
          '.job-card',
          '.job',
          'div[class*="job"]',
          'a[href*="job"]',
          'h1 a, h2 a, h3 a', // Job titles are often in headers with links
          '.search-result',
          '.result',
          'li',
          'div.card'
        ];

        let jobElements = [];
        let workingSelector = null;

        for (const selector of possibleSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              console.log(`Found ${elements.length} elements with selector: ${selector}`);
              
              // Test if these elements contain job-like content
              const sampleContent = await elements[0].evaluate(el => el.textContent.toLowerCase());
              if (sampleContent.includes('data') || sampleContent.includes('analyst') || 
                  sampleContent.includes('job') || sampleContent.includes('position')) {
                jobElements = elements;
                workingSelector = selector;
                console.log(`Using selector: ${selector}`);
                break;
              }
            }
          } catch (err) {
            // Continue to next selector
          }
        }

        if (jobElements.length === 0) {
          console.log('No job elements found, trying to extract from page content...');
          
          // Extract job information from the page content
          const jobsFromContent = await page.evaluate((searchTerm) => {
            const jobs = [];
            
            // Look for links that might be job postings
            const allLinks = document.querySelectorAll('a');
            
            allLinks.forEach(link => {
              const text = link.textContent.trim();
              const href = link.href;
              
              if (text && href && text.length > 5 && text.length < 100 &&
                  (text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   searchTerm.toLowerCase().split(' ').some(term => text.toLowerCase().includes(term)) ||
                   text.toLowerCase().includes('data') ||
                   text.toLowerCase().includes('analyst'))) {
                
                // Try to find additional info near the link
                let company = '';
                let location = '';
                let description = '';
                
                // Look in parent elements for company and location
                let parent = link.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                  const parentText = parent.textContent;
                  
                  // Look for company names (usually contain "cruise", "msc", "royal", etc.)
                  if (!company && (parentText.toLowerCase().includes('cruise') || 
                                  parentText.toLowerCase().includes('msc') ||
                                  parentText.toLowerCase().includes('royal') ||
                                  parentText.toLowerCase().includes('carnival'))) {
                    const lines = parentText.split('\n').map(l => l.trim()).filter(l => l);
                    company = lines.find(l => l.toLowerCase().includes('cruise') || 
                                           l.toLowerCase().includes('msc') ||
                                           l.toLowerCase().includes('royal')) || '';
                  }
                  
                  // Look for location indicators
                  if (!location && (parentText.includes('USA') || parentText.includes('United States') ||
                                   parentText.includes('Florida') || parentText.includes('Miami') ||
                                   parentText.includes('Caribbean'))) {
                    const lines = parentText.split('\n').map(l => l.trim()).filter(l => l);
                    location = lines.find(l => l.includes('USA') || l.includes('United States') ||
                                             l.includes('Florida') || l.includes('Miami') ||
                                             l.includes('Caribbean')) || '';
                  }
                  
                  parent = parent.parentElement;
                }
                
                jobs.push({
                  title: text,
                  href: href,
                  company: company.substring(0, 100), // Limit length
                  location: location.substring(0, 100),
                  description: description
                });
              }
            });
            
            // Remove duplicates
            const unique = [];
            const seen = new Set();
            
            jobs.forEach(job => {
              if (!seen.has(job.title + job.href)) {
                seen.add(job.title + job.href);
                unique.push(job);
              }
            });
            
            return unique;
          }, searchQuery);

          console.log(`Found ${jobsFromContent.length} jobs from content extraction`);
          
          if (jobsFromContent.length > 0) {
            jobElements = jobsFromContent;
            workingSelector = 'content-extraction';
          }
        }

        if (jobElements.length > 0) {
          foundJobs = true;
          console.log(`Processing ${jobElements.length} job elements...`);

          // Process job elements
          for (let i = 0; i < Math.min(jobElements.length, 50); i++) {
            try {
              let jobData;
              
              if (workingSelector === 'content-extraction') {
                // Jobs already extracted from content
                jobData = jobElements[i];
              } else {
                // Extract from DOM elements
                jobData = await jobElements[i].evaluate(el => {
                  const titleEl = el.querySelector('a, h1, h2, h3') || el;
                  const title = titleEl.textContent.trim();
                  const href = el.querySelector('a')?.href || titleEl.href || '';
                  
                  // Look for company and location in the element
                  const fullText = el.textContent;
                  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
                  
                  let company = '';
                  let location = '';
                  
                  lines.forEach(line => {
                    if (line.toLowerCase().includes('cruise') || line.toLowerCase().includes('msc') ||
                        line.toLowerCase().includes('royal') || line.toLowerCase().includes('carnival')) {
                      company = line;
                    }
                    if (line.includes('USA') || line.includes('United States') || 
                        line.includes('Florida') || line.includes('Caribbean')) {
                      location = line;
                    }
                  });
                  
                  return { title, href, company, location };
                });
              }

              if (!jobData || !jobData.title || jobData.title.length < 3) continue;

              // Parse location and check if it's US-accessible
              let location = jobData.location || 'International Waters';
              const { city, state, country, isUS } = parseLocation(location);

              // Filter for US jobs if requested
              if (usOnly && !isUS) {
                console.log(`  Skipping non-US job: ${jobData.title} (${location})`);
                continue;
              }

              const finalJobData = {
                employer_name: jobData.company || "Cruise Line",
                job_title: cleanJobTitle(jobData.title),
                job_city: city,
                job_state: state,
                job_posted_at: 'Recently',
                job_description: `${searchQuery} position on cruise ships - ${jobData.title}`,
                job_apply_link: jobData.href.startsWith('http') ? jobData.href : `https://www.allcruisejobs.com${jobData.href}`
              };

              allJobs.push(finalJobData);
              console.log(`  ✓ Added: ${jobData.title} - ${city}, ${state}`);

            } catch (err) {
              console.error(`Error processing job element ${i}:`, err.message);
            }
          }
        }

      } catch (err) {
        console.error(`Error with URL ${baseUrl}:`, err.message);
        continue;
      }
    }

    if (!foundJobs) {
      console.log('\nNo jobs found with any URL pattern. Page structure may have changed.');
      
      // Final attempt: look for any data-related content
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasDataText: document.body.textContent.toLowerCase().includes('data'),
          linkCount: document.querySelectorAll('a').length,
          h1Count: document.querySelectorAll('h1').length,
          h2Count: document.querySelectorAll('h2').length,
          h3Count: document.querySelectorAll('h3').length,
          allDataLinks: Array.from(document.querySelectorAll('a')).filter(a => 
            a.textContent.toLowerCase().includes('data')).map(a => ({
            text: a.textContent.trim(),
            href: a.href
          })).slice(0, 10)
        };
      });
      
      console.log('Page analysis:', JSON.stringify(pageInfo, null, 2));
    }

  } catch (err) {
    console.error('Error during scraping:', err);
  } finally {
    await browser.close();
  }

  console.log(`\nScraping completed! Found ${allJobs.length} ${usOnly ? 'US-accessible ' : ''}jobs.`);
  return allJobs;
}

// Example usage
async function main() {
  const args = process.argv.slice(2);
  const searchQuery = args.filter(arg => !arg.startsWith('--')).join(' ') || 'Data Science';
  const usOnly = !args.includes('--all-locations'); // Default to US-accessible only
  
  console.log(`=== Scraping All Cruise Jobs for: "${searchQuery}" ===`);
  const jobs = await cruiseJobsScraper(searchQuery, 10, usOnly);
  
  console.log(`\nFinal result: Found ${jobs.length} ${usOnly ? 'US-accessible ' : ''}jobs for "${searchQuery}"`);
  
  if (jobs.length > 0) {
    console.log('\nJobs found:');
    jobs.forEach((job, index) => {
      console.log(`\n${index + 1}. ${job.job_title}`);
      console.log(`   Company: ${job.employer_name}`);
      console.log(`   Location: ${job.job_city}, ${job.job_state}`);
      console.log(`   Link: ${job.job_apply_link}`);
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total jobs: ${jobs.length}`);
    const companies = [...new Set(jobs.map(job => job.employer_name))];
    console.log(`Companies: ${companies.join(', ')}`);
    
    console.log('\nFull JSON output:');
    console.log(JSON.stringify(jobs, null, 2));
  } else {
    console.log(`\nNo ${usOnly ? 'US-accessible ' : ''}jobs found for "${searchQuery}".`);
    console.log('\nTips:');
    console.log('- Try broader search terms like "Data" instead of "Data Science"');
    if (usOnly) {
      console.log('- Use --all-locations flag to include international cruise jobs');
    }
  }
}

module.exports = cruiseJobsScraper;

if (require.main === module) {
  main();
}