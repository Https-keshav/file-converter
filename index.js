import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000; // ✅ FIXED

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "public/uploads/" });

// Home page
app.get("/", (req, res) => {
  res.render("form");
});

// Handle conversion
app.post("/convert", upload.array("files", 10), async (req, res) => {
  try {
    const { type } = req.body;
    const outputFiles = [];

    for (const file of req.files) {
      const inputPath = file.path;
      const originalName = file.originalname;
      const outputDir = path.join(__dirname, "public", "uploads");
      const outputBase = path.basename(originalName, path.extname(originalName));
      let outputFilePath;

      // ✅ DOCX → PDF
      if (type === "docx-to-pdf") {
        const htmlResult = await mammoth.convertToHtml({ path: inputPath });

        const browser = await puppeteer.launch({
          args: ["--no-sandbox", "--disable-setuid-sandbox"], // ✅ REQUIRED
        });

        const page = await browser.newPage();
        await page.setContent(htmlResult.value);

        outputFilePath = path.join(outputDir, `${outputBase}.pdf`);
        await page.pdf({ path: outputFilePath, format: "A4" });

        await browser.close();
      }

      // ✅ PNG → PDF
      else if (type === "png-to-pdf") {
        const pdfDoc = await PDFDocument.create();
        const imageBytes = fs.readFileSync(inputPath);
        const image = await pdfDoc.embedPng(imageBytes);

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });

        const pdfBytes = await pdfDoc.save();
        outputFilePath = path.join(outputDir, `${outputBase}.pdf`);
        fs.writeFileSync(outputFilePath, pdfBytes);
      }

      else {
        throw new Error("Unsupported conversion type");
      }

      outputFiles.push({
        name: path.basename(outputFilePath),
        path: `/public/uploads/${path.basename(outputFilePath)}`,
      });
    }

    res.render("result", { outputFiles });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error during file conversion.");
  }
});

app.listen(port, () =>
  console.log(`✅ Server running on port ${port}`)
);