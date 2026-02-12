const fs = require("fs");
const path = require("path");
const jobCategories = require("./job_categories.json");
const {
  companies,
  ALL_COMPANIES,
  getCompanyEmoji,
  getCompanyCareerUrl,
  formatTimeAgo,
  getExperienceLevel,
  formatLocation,
  generateMinimalJobFingerprint,
} = require("./utils");

// Path to repo root README.md
const REPO_README_PATH = path.join(__dirname, '../../../README.md');
// Import or load the JSON configuration

// Filter jobs by age (1 week = 7 days)
// NOTE: This function is NOT used - job-processor.js already filters by age (14 days)
// The currentJobs/archivedJobs split is done in job-processor, not here
// Keeping this for backwards compatibility but it should not be called
function filterJobsByAge(allJobs) {
  // Jobs are already filtered by job-processor.js to 14-day window
  // No additional filtering needed here
  return {
    currentJobs: allJobs,
    archivedJobs: []
  };
}

// Helper function to categorize a job based on keywords
function getJobCategoryFromKeywords(jobTitle, jobDescription = '') {
  const text = `${jobTitle} ${jobDescription}`.toLowerCase();

  // Check each category's keywords
  for (const [categoryKey, categoryData] of Object.entries(jobCategories)) {
    for (const keyword of categoryData.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return categoryKey;
      }
    }
  }

  return 'data_scientist'; // Default fallback for software engineering
}

// Filter out senior positions - only keep Entry-Level and Mid-Level
function filterOutSeniorPositions(jobs) {
  return jobs.filter(job => {
    const level = getExperienceLevel(job.job_title, job.job_description);
    return level !== "Senior";
  });
}

// Generate job table organized by job type categories
function generateJobTable(jobs) {
  console.log('Starting generateJobTable', { total_jobs: jobs.length });

  jobs = filterOutSeniorPositions(jobs);
  console.log('After filtering seniors', { remaining_jobs: jobs.length });

  if (jobs.length === 0) {
    return `| Company | Role | Location | Posted | Level | Apply |
|---------|------|----------|--------|-------|-------|
| *No current openings* | *Check back tomorrow* | *-* | *-* | *-* | *-* |`;
  }

  console.log('Configured job categories', {
    categories: Object.entries(jobCategories).map(([categoryKey, category]) => ({
      emoji: category.emoji,
      title: category.title,
      keywords: category.keywords.join(', ')
    }))
  });

  // Categorize each job and group by category
  const jobsByCategory = {};
  const categorizedJobs = new Set();

  jobs.forEach((job) => {
    const categoryKey = getJobCategoryFromKeywords(job.job_title, job.job_description);
    // Use fingerprint instead of job.id to handle jobs without id field
    const jobFingerprint = generateMinimalJobFingerprint(job);
    categorizedJobs.add(jobFingerprint);

    if (!jobsByCategory[categoryKey]) {
      jobsByCategory[categoryKey] = [];
    }
    jobsByCategory[categoryKey].push(job);
  });

  console.log('Jobs by category', {
    by_category: Object.entries(jobsByCategory).map(([categoryKey, categoryJobs]) => ({
      category: jobCategories[categoryKey]?.title || categoryKey,
      count: categoryJobs.length
    }))
  });

  let output = "";

  // Handle each job category
  Object.entries(jobCategories).forEach(([categoryKey, categoryData]) => {
    const categoryJobs = jobsByCategory[categoryKey];

    if (!categoryJobs || categoryJobs.length === 0) {
      return; // Skip empty categories
    }

    const totalJobs = categoryJobs.length;
    console.log('Processing category', { category: categoryData.title, jobs: totalJobs });

    // Group jobs by company within this category
    const jobsByCompany = {};
    categoryJobs.forEach((job) => {
      const company = job.employer_name;
      if (!jobsByCompany[company]) {
        jobsByCompany[company] = [];
      }
      jobsByCompany[company].push(job);
    });

    // Start collapsible category section
    output += `<details>\n`;
    output += `<summary><h3>${categoryData.emoji} <strong>${categoryData.title}</strong> (${totalJobs} positions)</h3></summary>\n\n`;

    // Handle companies with >10 jobs separately
    const bigCompanies = Object.entries(jobsByCompany)
      .filter(([_, companyJobs]) => companyJobs.length > 10)
      .sort((a, b) => b[1].length - a[1].length);

    bigCompanies.forEach(([companyName, companyJobs]) => {
      const emoji = getCompanyEmoji(companyName);

      // Sort jobs by date (newest first)
      const sortedJobs = companyJobs.sort((a, b) => {
        const dateA = new Date(a.job_posted_at_datetime_utc);
        const dateB = new Date(b.job_posted_at_datetime_utc);
        return dateB - dateA; // Newest first
      });

      if (companyJobs.length > 50) {
        output += `<details>\n`;
        output += `<summary><h4>${emoji} <strong>${companyName}</strong> (${companyJobs.length} positions)</h4></summary>\n\n`;
      } else {
        output += `#### ${emoji} **${companyName}** (${companyJobs.length} positions)\n\n`;
      }

      output += `| Role | Location | Posted | Level | Apply |\n`;
      output += `|------|----------|--------|-------|-------|\n`;

      sortedJobs.forEach((job) => {
        const role = job.job_title.length > 35 ? job.job_title.substring(0, 32) + "..." : job.job_title;
        const location = formatLocation(job.job_city, job.job_state);
        const posted = formatTimeAgo(job.job_posted_at_datetime_utc);
        const level = getExperienceLevel(job.job_title, job.job_description);
        const applyLink = job.job_apply_link || getCompanyCareerUrl(job.employer_name);

        const levelShort = {
          "Entry-Level": '![Entry](https://img.shields.io/badge/-Entry-brightgreen "Entry-Level")',
          "Mid-Level": '![Mid](https://img.shields.io/badge/-Mid-blue "Mid-Level")',
          "Senior": '![Senior](https://img.shields.io/badge/-Senior-red "Senior-Level")'
        }[level] || level;

        let statusIndicator = "";
        const description = (job.job_description || "").toLowerCase();
        if (description.includes("no sponsorship") || description.includes("us citizen")) {
          statusIndicator = " 🇺🇸";
        }
        if (description.includes("remote")) {
          statusIndicator += " 🏠";
        }

        output += `| ${role}${statusIndicator} | ${location} | ${posted} | ${levelShort} | [<img src="images/apply.png" width="75" alt="Apply">](${applyLink}) |\n`;
      });

      if (companyJobs.length > 50) {
        output += `\n</details>\n\n`;
      } else {
        output += "\n";
      }
    });

    // Combine companies with <=10 jobs into one table
    const smallCompanies = Object.entries(jobsByCompany)
      .filter(([_, companyJobs]) => companyJobs.length <= 10);

    if (smallCompanies.length > 0) {
      // Flatten all jobs from small companies and sort by date
      const allSmallCompanyJobs = smallCompanies.flatMap(([companyName, companyJobs]) =>
        companyJobs.map(job => ({ ...job, companyName }))
      );

      // Sort all jobs by date (newest first)
      allSmallCompanyJobs.sort((a, b) => {
        const dateA = new Date(a.job_posted_at_datetime_utc);
        const dateB = new Date(b.job_posted_at_datetime_utc);
        return dateB - dateA; // Newest first
      });

      output += `| Company | Role | Location | Posted | Level | Apply |\n`;
      output += `|---------|------|----------|--------|-------|-------|\n`;

      allSmallCompanyJobs.forEach((job) => {
        const companyName = job.companyName;
        const emoji = getCompanyEmoji(companyName);

        const role = job.job_title.length > 35 ? job.job_title.substring(0, 32) + "..." : job.job_title;
        const location = formatLocation(job.job_city, job.job_state);
        const posted = formatTimeAgo(job.job_posted_at_datetime_utc);
        const level = getExperienceLevel(job.job_title, job.job_description);
        const applyLink = job.job_apply_link || getCompanyCareerUrl(job.employer_name);

        const levelShort = {
          "Entry-Level": '![Entry](https://img.shields.io/badge/-Entry-brightgreen "Entry-Level")',
          "Mid-Level": '![Mid](https://img.shields.io/badge/-Mid-blue "Mid-Level")',
          "Senior": '![Senior](https://img.shields.io/badge/-Senior-red "Senior-Level")'
        }[level] || level;

        let statusIndicator = "";
        const description = (job.job_description || "").toLowerCase();
        if (description.includes("no sponsorship") || description.includes("us citizen")) {
          statusIndicator = " 🇺🇸";
        }
        if (description.includes("remote")) {
          statusIndicator += " 🏠";
        }

        output += `| ${emoji} **${companyName}** | ${role}${statusIndicator} | ${location} | ${posted} | ${levelShort} | [<img src="images/apply.png" width="75" alt="Apply">](${applyLink}) |\n`;
      });

      output += "\n";
    }

    // End collapsible category section
    output += `</details>\n\n`;
  });

  console.log('Finished generating job table', { categorized_jobs: categorizedJobs.size });
  return output;
}

function generateInternshipSection(internshipData) {
  if (!internshipData) return "";

  return `

---

## SWE Internships 2026

<img src="images/sej-internships.png" alt="Software engineering internships for 2026.">

### 🏢 **FAANG+ Internship Programs**

| Company | Program | Application Link |
|---------|---------|------------------|
${internshipData.companyPrograms
  .map((program) => {
    const companyObj = ALL_COMPANIES.find((c) => c.name === program.company);
    const emoji = companyObj ? companyObj.emoji : "🏢";
    return `| ${emoji} **${program.company}** | ${program.program} | <p align="center">[<img src="images/apply.png" width="75" alt="Apply button">](${program.url})</p> |`;
  })
  .join("\n")}

### 📚 **Top Software Internship Resources**

| Platform | Type | Description | Link |
|----------|------|-------------|------|
${internshipData.sources
  .map(
    (source) =>
      `| **${source.emogi} ${source.name}** | ${source.type} | ${source.description} | [<img src="images/sej-visit.png" width="75" alt="Visit button">](${source.url}) |`
  )
  .join("\n")}

`;
}

function generateArchivedSection(archivedJobs, stats) {
  if (archivedJobs.length === 0) return "";

  const archivedFaangJobs = archivedJobs.filter((job) =>
    companies.faang_plus?.companies?.includes(job.employer_name)
  ).length;

  return `
---

<details>
<summary><h2>📁 <strong>Archived SWE Jobs</strong> - ${
    archivedJobs.length
  } (7+ days old) - Click to Expand</h2></summary>

> Either still hiring or useful for research.

### **Archived Job Stats**
- **📁 Total Jobs**: ${archivedJobs.length} positions
- **🏢 Companies**: ${Object.keys(stats.totalByCompany).length} companies  
- **⭐ FAANG+ Jobs & Internships**: ${archivedFaangJobs} roles

${generateJobTable(archivedJobs)}

</details>

---

`;
}

// Generate comprehensive README
async function generateReadme(
  currentJobs,
  archivedJobs = [],
  internshipData = null,
  stats = null
) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalCompanies = Object.keys(stats?.totalByCompany || {}).length;
  // Filter out senior positions BEFORE calculating badge counts
  currentJobs = filterOutSeniorPositions(currentJobs);

  const faangJobs = currentJobs.filter((job) =>
    companies.faang_plus?.companies?.includes(job.employer_name)
  ).length;

  return `<div align="center">

<!-- Banner -->
<img src="images/dsj-heading.png" alt="Data Science Jobs 2026 - Illustration of people working in data science.">

# Data Science Jobs 2026

<!-- Row 1: Job Stats (Custom Static Badges) -->
![Total Jobs](https://img.shields.io/badge/Total_Jobs-${currentJobs.length}-brightgreen?style=flat&logo=briefcase) ![Companies](https://img.shields.io/badge/Companies-${totalCompanies}-blue?style=flat&logo=building) ${faangJobs > 0 ? '![FAANG+ Jobs](https://img.shields.io/badge/FAANG+_Jobs-' + faangJobs + '-red?style=flat&logo=star) ' : ''}![Updated](https://img.shields.io/badge/Updated-Every_15_Minutes-orange?style=flat&logo=calendar)

</div>

<p align="center">🚀 Real-time software engineering, programming, and IT jobs from ${totalCompanies}+ top companies like Tesla, NVIDIA, and Raytheon. Updated every 15 minutes with ${currentJobs.length}+ fresh opportunities for new graduates, CS students, and entry-level software developers.</p>

<p align="center">🎯 Includes roles across tech giants, fast-growing startups, and engineering-first companies like Chewy, CACI, and TD Bank.</p>

> [!TIP]
> 🛠 Help us grow! Add new jobs by submitting an issue! View contributing steps [here](CONTRIBUTING-GUIDE.md).

---

## Website & Autofill Extension

<img src="images/zapply.png" alt="Apply to jobs in seconds with Zapply.">

Explore Zapply's website and check out:

- Our chrome extension that auto-fills your job applications in seconds.
- A dedicated job board with the latest jobs for various types of roles.
- User account providing multiple profiles for different resume roles.
- Job application tracking with streaks to unlock commitment awards.

Experience an advanced career journey with us! 🚀

<p align="center">
  <a href="https://zapply.jobs/"><img src="images/zapply-button.png" alt="Visit Our Website" width="300"></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href=""><img src="images/extension-button.png" alt="Install Our Extension - Coming Soon" width="300"></a>
</p>

---

## Explore Around

<img src="images/community.png" alt="Explore Around">

Connect and seek advice from a growing network of fellow students and new grads.

<p align="center">
  <a href="https://discord.gg/UswBsduwcD"><img src="images/discord-2d.png" alt="Visit Our Website" width="250"></a>
  &nbsp;&nbsp;
  <a href="https://www.instagram.com/zapplyjobs"><img src="images/instagram-icon-2d.png" alt="Instagram" height="75"></a>
  &nbsp;&nbsp;
  <a href="https://www.tiktok.com/@zapplyjobs"><img src="images/tiktok-icon-2d.png" alt="TikTok" height="75"></a>
</p>

---

## Fresh Software Jobs 2026

<img src="images/sej-listings.png" alt="Fresh 2026 job listings (under 1 week).">

${generateJobTable(currentJobs)}

---

## More Resources

<img src="images/more-resources.png" alt="Jobs and templates in our other repos.">

Check out our other repos for jobs and free resources:

<p align="center">
  <a href="https://github.com/zapplyjobs/New-Grad-Data-Science-Jobs-2026"><img src="images/repo-dsj.png" alt="Data Science Jobs" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/New-Grad-Hardware-Engineering-Jobs-2026"><img src="images/repo-hej.png" alt="Hardware Engineering Jobs" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/New-Grad-Nursing-Jobs-2026"><img src="images/repo-nsj.png" alt="Nursing Jobs" height="40"></a>
</p>
<p align="center">
  <a href="https://github.com/zapplyjobs/New-Grad-Jobs-2026"><img src="images/repo-ngj.png" alt="New Grad Jobs" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/Remote-Jobs-2026"><img src="images/repo-rmj.png" alt="Remote Jobs" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/resume-samples-2026"><img src="images/repo-rss.png" alt="Resume Samples" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/interview-handbook-2026"><img src="images/repo-ihb.png" alt="Interview Handbook" height="40"></a>
</p>
<p align="center">
  <a href="https://github.com/zapplyjobs/Internships-2026"><img src="images/repo-int.png" alt="Internships 2026" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/Research-Internships-for-Undergraduates"><img src="images/repo-rifu.png" alt="Research Internships" height="40"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/zapplyjobs/underclassmen-internships"><img src="images/repo-uci.png" alt="Underclassmen Internships" height="40"></a>
</p>

---

## Become a Contributor

<img src="images/contributor.png" alt="Become a Contributor">

Add new jobs to our listings keeping in mind the following:

- Located in the US, Canada, or Remote.
- Openings are currently accepting applications and not older than 1 week.
- Create a new issue to submit different job positions.
- Update a job by submitting an issue with the job URL and required changes.

Our team reviews within 24-48 hours and approved jobs are added to the main list!

Questions? Create a miscellaneous issue, and we'll assist! 🙏

${archivedJobs.length > 0 ? generateArchivedSection(archivedJobs, stats) : ""}

---

<div align="center">

**🎯 ${
    currentJobs.length
  } current opportunities from ${totalCompanies} elite companies.**

**Found this helpful? Give it a ⭐ to support us!**

*Not affiliated with any companies listed. All applications redirect to official career pages.*

---

**Last Updated:** ${currentDate} • **Next Update:** Daily at 9 AM UTC

</div>`;
}

// Update README file
async function updateReadme(currentJobs, archivedJobs, internshipData, stats) {
  try {
    console.log("📝 Generating README content...");
    const readmeContent = await generateReadme(
      currentJobs,
      archivedJobs,
      internshipData,
      stats
    );
    fs.writeFileSync(REPO_README_PATH, readmeContent, "utf8");
    console.log(`✅ README.md updated with ${currentJobs.length} current jobs`);

    console.log("\n📊 Summary:");
    console.log(`- Total current: ${currentJobs.length}`);
    console.log(`- Archived:      ${archivedJobs.length}`);
    console.log(
      `- Companies:     ${Object.keys(stats?.totalByCompany || {}).length}`
    );
  } catch (err) {
    console.error("❌ Error updating README:", err);
    throw err;
  }
}

module.exports = {
  generateJobTable,
  generateInternshipSection,
  generateArchivedSection,
  generateReadme,
  updateReadme,
  filterJobsByAge,
  filterOutSeniorPositions,  // ADD THIS
};

