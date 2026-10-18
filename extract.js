const fs = require("fs");
const pdfParse = require("pdf-parse");

console.log("Reading PDF...");
const dataBuffer = fs.readFileSync("./public/anatomy-book.pdf");

// Parse the PDF natively
pdfParse(dataBuffer).then(function(data) {
    console.log("PDF Extracted! Writing to JSON file...");
    
    // Save the text to a JSON file
    fs.writeFileSync("./public/book-text.json", JSON.stringify({ text: data.text }));
    
    console.log("✅ Done! You can now start the server and run the Next.js API route.");
}).catch(function(error) {
    console.error("Error extracting PDF:", error);
});