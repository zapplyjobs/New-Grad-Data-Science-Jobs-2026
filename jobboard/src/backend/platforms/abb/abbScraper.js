const puppeteer = require("puppeteer");

// Helper function to clean job titles
function cleanJobTitle(title) {
  if (!title) return title;
  return title
    .replace(/\s+(I|II|III|IV|V|\d+)$/, "")
    .replace(/\s*-\s*(Remote|Hybrid|On-site).*$/i, "")
    .trim();
}

// Helper function to clean location text
function cleanLocationText(locationText) {
  if (!locationText) return locationText;

  let cleanedText = locationText
    .replace(/Location\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "")
    .trim();

  // Check for pattern like "Available in one of 4 s"
  if (cleanedText.match(/Available in one of \d+ s/i)) {
    // Append example locations
    cleanedText +=
      " (e.g., Bangalore, Karnataka, India; New York, NY, USA; London, UK; Sydney, NSW, Australia)";
  }

  return cleanedText;
}
// Helper function to format posted date to relative time
function formatPostedDate(dateString) {
  if (!dateString) return "Recently";

  if (dateString.includes("T") && dateString.includes(".000+0000")) {
    try {
      const jobDate = new Date(dateString);
      const now = new Date();
      const diffMs = now - jobDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "1 day ago";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 14) return "1 week ago";
      if (diffDays < 21) return "2 weeks ago";
      if (diffDays < 28) return "3 weeks ago";
      if (diffDays < 60) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (error) {
      return dateString;
    }
  }
  return dateString;
}

// Helper function to parse location
function parseLocation(locationText) {
  if (!locationText) {
    return { city: "Remote", state: "Remote" };
  }

  const cleanedLocation = locationText
    .replace(/Location\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "")
    .trim();

  // Check for pattern like "Available in one of X s" with appended locations
  if (cleanedLocation.match(/Available in one of \d+ s/i)) {
    const exampleLocations = cleanedLocation.match(/\((.*?)\)/);
    if (exampleLocations && exampleLocations[1]) {
      const locations = exampleLocations[1].split(";").map((loc) => loc.trim());
      if (locations.length > 0) {
        const [firstLocation] = locations[0].split(",");
        return {
          city: firstLocation.trim(),
          state: locations.length > 1 ? locations[1].trim() : "N/A",
        };
      }
    }
    return { city: "Multiple", state: "Various" };
  }

  const locationParts = cleanedLocation.split(",").map((part) => part.trim());

  if (locationParts.length >= 2) {
    return { city: locationParts[0], state: locationParts[1] };
  } else {
    const location = cleanedLocation.trim();
    return { city: location, state: location };
  }
}

// Function to apply USA filter only once
async function applyUSAFilter(page) {
  console.log("=== Applying USA location filter ===");

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Click location accordion
      await page.waitForSelector(
        "button#Country\\/Territory\\/AreaAccordion.facet-menu.au-target",
        { timeout: 10000 }
      );
      const accordionButton = await page.$(
        "button#Country\\/Territory\\/AreaAccordion.facet-menu.au-target"
      );

      if (accordionButton) {
        console.log(`✓ Clicking location accordion... (Attempt ${attempt})`);
        await accordionButton.click({ delay: 100 });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log(`⚠ Accordion button not found (Attempt ${attempt})`);
        continue;
      }

      // Ensure the search input is visible and interactable
      await page.waitForSelector(
        "input[id='facetInput_5'][data-ps='1c680c5e-input-1']",
        { visible: true, timeout: 10000 }
      );
      const searchInput = await page.$(
        "input[id='facetInput_5'][data-ps='1c680c5e-input-1']"
      );

      if (searchInput) {
        console.log(
          `✓ Typing 'United States of America'... (Attempt ${attempt})`
        );
        await searchInput.focus();
        await page.evaluate(() => (document.activeElement.value = ""));
        await searchInput.type("United States of America", { delay: 100 });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Ensure USA checkbox is visible and interactable
        await page.waitForSelector("input#country_phs_0.au-target", {
          visible: true,
          timeout: 10000,
        });
        const usaCheckbox = await page.$("input#country_phs_0.au-target");

        if (usaCheckbox) {
          console.log(`✓ Clicking USA checkbox... (Attempt ${attempt})`);
          await usaCheckbox.click({ delay: 100 });
          console.log("✓ USA filter applied successfully");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return true;
        } else {
          console.log(`⚠ USA checkbox not found (Attempt ${attempt})`);
        }
      } else {
        console.log(`⚠ Search input not found (Attempt ${attempt})`);
      }
    } catch (error) {
      console.log(
        `Error applying USA filter (Attempt ${attempt}/${maxRetries}): ${error.message}`
      );
      if (attempt === maxRetries) {
        console.log("⚠ Max retries reached, could not apply USA filter");
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return false;
}

async function abbScraper(searchQuery, maxPages = 10) {
  const allJobs = [];
  const baseUrl = "https://careers.abb/global/en/search-results";

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-web-security",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1080 });

  // Disable images and CSS for faster loading
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const resourceType = req.resourceType();
    if (resourceType === "stylesheet" || resourceType === "image") {
      req.abort();
    } else {
      req.continue();
    }
  });

  let lastProcessedPage = 0; // Track the last page processed
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    const fromPage = (pageNumber - 1) * 10;

    const searchUrl = `${baseUrl}?keywords=${encodeURIComponent(
      searchQuery
    )}&from=${fromPage}&s=1`;

    console.log(
      `Searching for: "${searchQuery}" on page ${pageNumber} (fromPage=${fromPage})`
    );
    console.log(`Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: ["networkidle2", "domcontentloaded"],
      timeout: 60000,
    });

    // Wait for initial content
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Apply USA filter only for first page
    if (pageNumber === 1) {
      await applyUSAFilter(page);
    }

    console.log("=== Scraping jobs ===");

    // Wait for job results
    let jobItems;
    try {
      await page.waitForSelector(
        "li.jobs-list-item.au-target.phw-card-block-nd",
        { timeout: 55000 }
      );
      jobItems = await page.$$("li.jobs-list-item.au-target.phw-card-block-nd");
    } catch (error) {
      console.log(`No jobs found on page ${pageNumber}, stopping scrape...`);
      break; // Exit the loop if no jobs are found
    }

    console.log(`Found ${jobItems.length} job items on page ${pageNumber}`);

    // Extract job data
    for (let i = 0; i < jobItems.length; i++) {
      try {
        const jobData = await jobItems[i].evaluate((itemElement) => {
          const titleElement = itemElement.querySelector("span.au-target");
          const title = titleElement ? titleElement.textContent.trim() : "";

          const linkElement = itemElement.querySelector("a");
          const applyLink = linkElement ? linkElement.getAttribute("href") : "";

          const locationElement = itemElement.querySelector(
            ".job-location.au-target"
          );
          let location = locationElement ? locationElement.textContent : "";

          if (location) {
            location = location
              .replace(/Location\s*/gi, "")
              .replace(/\s+/g, " ")
              .replace(/\n+/g, "")
              .trim();
          }

          const postedElement = itemElement.querySelector(
            "a[data-ph-at-job-post-date-text]"
          );
          let postedDate = postedElement
            ? postedElement.getAttribute("data-ph-at-job-post-date-text")
            : "Recently";

          return { title, applyLink, location, postedDate };
        });

        if (!jobData.title) {
          console.log(
            `⚠ Skipping item ${i + 1} on page ${pageNumber}: No title found`
          );
          continue;
        }

        const { city, state } = parseLocation(jobData.location);
        const formattedPostedDate = formatPostedDate(jobData.postedDate);

        const formattedJob = {
          employer_name: "ABB",
          job_title: cleanJobTitle(jobData.title),
          job_city: city,
          job_state: state,
          job_posted_at: formattedPostedDate,
          job_description:`${searchQuery} job for the role ${jobData.title} at ${jobData.location}`,
          job_apply_link: jobData.applyLink || searchUrl,
        };

        allJobs.push(formattedJob);
        console.log(
          `✓ Scraped (${i + 1}/${jobItems.length} on page ${pageNumber}): ${
            jobData.title
          } at ${city}, ${state}`
        );
      } catch (error) {
        console.error(
          `Error extracting job data from item ${i + 1} on page ${pageNumber}:`,
          error
        );
        continue;
      }
    }

    lastProcessedPage = pageNumber; // Update the last processed page
  }

  await browser.close();
  console.log(
    `\n🎉 Scraping completed! Found ${allJobs.length} total jobs across ${lastProcessedPage} page${lastProcessedPage === 1 ? '' : 's'}.`
  );
  return allJobs;
}

module.exports = abbScraper;

// Main function to run the scraper
async function main() {
  try {
    console.log('🚀 Starting ABB scraper...');
    console.log('Searching for data science jobs...');
    
    const jobs = await abbScraper('data science', 2); // Search for data science jobs, max 2 pages
    
    console.log('\n📊 Scraping Results:');
    console.log(`Total jobs found: ${jobs.length}`);
    
    if (jobs.length > 0) {
      console.log('\n📋 Job Details:');
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_title}`);
        console.log(`   Company: ${job.employer_name}`);
        console.log(`   Location: ${job.job_city}, ${job.job_state}`);
        console.log(`   Posted: ${job.job_posted_at}`);
        console.log(`   Apply: ${job.job_apply_link}`);
      });
    }
    
    console.log('\n✅ ABB scraper completed successfully!');
  } catch (error) {
    console.error('❌ Error running ABB scraper:', error);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}


