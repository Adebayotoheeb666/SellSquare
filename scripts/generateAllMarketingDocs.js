const path = require("path");
const { convertMarkdownToPdf } = require("../utils/convertMarkdownToPdf");

async function generateAllMarketingDocs() {
  console.log("\n=======================================================");
  console.log("GENERATING ALL MARKETING DOCUMENTS");
  console.log("=======================================================\n");

  try {
    // Generate Marketing Strategy PDF
    console.log("1/2 Generating Marketing Strategy Guide...");
    const strategyMdPath = path.join(
      __dirname,
      "..",
      "MARKETING_STRATEGY_FOR_INTERNS.md"
    );
    const strategyPdfPath = path.join(
      __dirname,
      "..",
      "MARKETING_STRATEGY_FOR_INTERNS.pdf"
    );
    await convertMarkdownToPdf(strategyMdPath, strategyPdfPath);
    console.log("✅ Marketing Strategy PDF created\n");

    // Generate Intern Work Schedule PDF
    console.log("2/2 Generating Intern Work Schedule...");
    const scheduleMdPath = path.join(
      __dirname,
      "..",
      "INTERN_WORK_SCHEDULE.md"
    );
    const schedulePdfPath = path.join(
      __dirname,
      "..",
      "INTERN_WORK_SCHEDULE.pdf"
    );
    await convertMarkdownToPdf(scheduleMdPath, schedulePdfPath);
    console.log("✅ Intern Work Schedule PDF created\n");

    console.log("=======================================================");
    console.log("SUCCESS! ALL DOCUMENTS GENERATED");
    console.log("=======================================================");
    console.log("\nGenerated Files:");
    console.log("1. MARKETING_STRATEGY_FOR_INTERNS.pdf (Comprehensive guide)");
    console.log("2. INTERN_WORK_SCHEDULE.pdf (Daily work schedule)\n");
    console.log("Ready to share with your marketing team!");
    console.log("=======================================================\n");
  } catch (error) {
    console.error("\n=======================================================");
    console.error("ERROR GENERATING DOCUMENTS");
    console.error("=======================================================");
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateAllMarketingDocs();
}

module.exports = { generateAllMarketingDocs };
