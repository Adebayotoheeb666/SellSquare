const path = require("path");
const { convertMarkdownToPdf } = require("../utils/convertMarkdownToPdf");

async function generateInternSchedulePdf() {
  const markdownPath = path.join(__dirname, "..", "INTERN_WORK_SCHEDULE.md");
  const pdfPath = path.join(__dirname, "..", "INTERN_WORK_SCHEDULE.pdf");

  console.log("================================================");
  console.log("GENERATING INTERN WORK SCHEDULE PDF");
  console.log("================================================\n");

  try {
    await convertMarkdownToPdf(markdownPath, pdfPath);

    console.log("\n================================================");
    console.log("SUCCESS! INTERN SCHEDULE PDF CREATED");
    console.log("================================================");
    console.log(`\nPDF Location: ${pdfPath}`);
    console.log("\nThis document is ready to share with interns!");
    console.log("It includes:");
    console.log("  - Daily work schedule (Mon-Fri)");
    console.log("  - Weekly activities breakdown");
    console.log("  - Monthly targets and calendar");
    console.log("  - Daily/Weekly/Monthly reporting templates");
    console.log("  - Performance targets and incentives");
    console.log("\n================================================\n");
  } catch (error) {
    console.error("\n================================================");
    console.error("ERROR GENERATING PDF");
    console.error("================================================");
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateInternSchedulePdf();
}

module.exports = { generateInternSchedulePdf };
