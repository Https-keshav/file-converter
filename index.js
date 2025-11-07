import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer";
import poppler from "pdf-poppler"; // ✅ imported properly for ES modules

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "public/uploads/" });

// ---------- ROUTES ----------

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

      switch (type) {
        case "docx-to-pdf": {
          const htmlResult = await mammoth.convertToHtml({ path: inputPath });
          const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
          const page = await browser.newPage();
          await page.setContent(htmlResult.value);
          outputFilePath = path.join(outputDir, `${outputBase}.pdf`);
          await page.pdf({ path: outputFilePath, format: "A4" });
          await browser.close();

          outputFiles.push({
            name: path.basename(outputFilePath),
            path: `/public/uploads/${path.basename(outputFilePath)}`,
          });
          break;
        }

        case "png-to-pdf": {
          const pdfDoc = await PDFDocument.create();
          const imageBytes = fs.readFileSync(inputPath);
          const image = await pdfDoc.embedPng(imageBytes);
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          const pdfBytes = await pdfDoc.save();
          outputFilePath = path.join(outputDir, `${outputBase}.pdf`);
          fs.writeFileSync(outputFilePath, pdfBytes);

          outputFiles.push({
            name: path.basename(outputFilePath),
            path: `/public/uploads/${path.basename(outputFilePath)}`,
          });
          break;
        }

        case "pdf-to-png": {
          const options = {
            format: "png",
            out_dir: outputDir,
            out_prefix: outputBase,
            page: null, // convert all pages
          };

          await poppler.convert(inputPath, options);
          // Get all generated PNGs
          const generatedFiles = fs
            .readdirSync(outputDir)
            .filter((f) => f.startsWith(outputBase) && f.endsWith(".png"))
            .map((f) => ({
              name: f,
              path: `/public/uploads/${f}`,
            }));

          outputFiles.push(...generatedFiles);
          break;
        }

        default:
          throw new Error("Unsupported conversion type");
      }
    }

    res.render("result", { outputFiles });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error during file conversion.");
  }
});

app.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));
