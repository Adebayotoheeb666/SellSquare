const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");

async function convertMarkdownToPdf(markdownPath, pdfPath) {
  try {
    console.log("Reading markdown file...");
    const markdownContent = await fs.readFile(markdownPath, "utf-8");

    console.log("Converting markdown to HTML...");
    const htmlContent = convertMarkdownToHtml(markdownContent);

    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    console.log("Setting content...");
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });

    console.log("Generating PDF...");
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; padding: 5px 15mm; text-align: center; color: #666;">
          <span>Sell Square Marketing Strategy Guide | Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await browser.close();

    console.log(`✅ PDF created successfully: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error("❌ Error converting markdown to PDF:", error);
    throw error;
  }
}

function convertMarkdownToHtml(markdown) {
  let html = markdown;

  // Remove any remaining emojis
  html = html.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");
  html = html.replace(/[\u{2600}-\u{26FF}]/gu, "");
  html = html.replace(/[\u{2700}-\u{27BF}]/gu, "");
  html = html.replace(/✅|❌|👋|😊|🚀/g, "");

  // Convert headers
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^#### (.*$)/gm, "<h4>$1</h4>");

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Convert code blocks
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Convert unordered lists
  html = html.replace(/^\- (.*$)/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Convert numbered lists
  html = html.replace(/^\d+\. (.*$)/gm, "<li>$1</li>");

  // Convert horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Convert line breaks to paragraphs
  html = html
    .split("\n\n")
    .map((para) => {
      if (
        para.trim() &&
        !para.startsWith("<h") &&
        !para.startsWith("<ul") &&
        !para.startsWith("<ol") &&
        !para.startsWith("<pre") &&
        !para.startsWith("<hr") &&
        !para.includes("<li>")
      ) {
        return `<p>${para}</p>`;
      }
      return para;
    })
    .join("\n");

  // Wrap in HTML structure
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sell Square - Marketing Strategy Guide for Interns</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      font-size: 11pt;
    }
    
    h1 {
      font-size: 24pt;
      font-weight: 700;
      margin: 20pt 0 15pt 0;
      color: #1a1a1a;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10pt;
      page-break-after: avoid;
    }
    
    h2 {
      font-size: 18pt;
      font-weight: 700;
      margin: 18pt 0 12pt 0;
      color: #1a1a1a;
      border-bottom: 2px solid #60a5fa;
      padding-bottom: 8pt;
      page-break-after: avoid;
    }
    
    h3 {
      font-size: 14pt;
      font-weight: 700;
      margin: 15pt 0 10pt 0;
      color: #374151;
      page-break-after: avoid;
    }
    
    h4 {
      font-size: 12pt;
      font-weight: 600;
      margin: 12pt 0 8pt 0;
      color: #4b5563;
      page-break-after: avoid;
    }
    
    p {
      margin: 8pt 0;
      text-align: justify;
    }
    
    ul, ol {
      margin: 10pt 0 10pt 20pt;
      padding-left: 15pt;
    }
    
    li {
      margin: 5pt 0;
      page-break-inside: avoid;
    }
    
    ul ul, ol ul, ul ol, ol ol {
      margin: 5pt 0 5pt 15pt;
    }
    
    code {
      background-color: #f3f4f6;
      padding: 2pt 4pt;
      border-radius: 3pt;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      color: #dc2626;
    }
    
    pre {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 5pt;
      padding: 12pt;
      margin: 12pt 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
      color: #1f2937;
      font-size: 9pt;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    hr {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 20pt 0;
    }
    
    strong {
      font-weight: 600;
      color: #1f2937;
    }
    
    em {
      font-style: italic;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      page-break-inside: avoid;
    }
    
    th, td {
      border: 1px solid #e5e7eb;
      padding: 8pt;
      text-align: left;
    }
    
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    
    /* Page break helpers */
    .page-break-before {
      page-break-before: always;
    }
    
    .page-break-after {
      page-break-after: always;
    }
    
    .avoid-break {
      page-break-inside: avoid;
    }
    
    /* Specific styles for forms/templates */
    pre.template {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
    }
    
    /* Ensure content doesn't overflow */
    * {
      max-width: 100%;
    }
    
    /* Better spacing for readability */
    section {
      margin-bottom: 15pt;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `.trim();
}

module.exports = { convertMarkdownToPdf };
