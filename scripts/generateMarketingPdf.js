const path = require("path");
const { convertMarkdownToPdf } = require("../utils/convertMarkdownToPdf");

async function generateMarketingPdf() {
  const markdownPath = path.join(
    __dirname,
    "..",
    "MARKETING_STRATEGY_FOR_INTERNS.md"
  );
  const pdfPath = path.join(
    __dirname,
    "..",
    "MARKETING_STRATEGY_FOR_INTERNS.pdf"
  );

  console.log("================================================");
  console.log("GENERATING MARKETING STRATEGY PDF");
  console.log("================================================\n");

  try {
    await convertMarkdownToPdf(markdownPath, pdfPath);

    console.log("\n================================================");
    console.log("SUCCESS! PDF GENERATION COMPLETE");
    console.log("================================================");
    console.log(`\nPDF Location: ${pdfPath}`);
    console.log("\nYou can now share this PDF with your marketing interns!");
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
  generateMarketingPdf();
}

module.exports = { generateMarketingPdf };
