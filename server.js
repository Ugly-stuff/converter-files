import express from "express";
import multer from "multer";
import fs from "fs-extra";
import path from "path";
import archiver from "archiver";
import cors from "cors";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();
const app = express();
app.use(cors(), express.json());

//uploads and output folders
const UPLOADS = path.join(process.cwd(), "uploads"); // giving access of current wroking directory
const OUTPUT = path.join(process.cwd(), "output");// same as...
fs.ensureDirSync(UPLOADS); // if not exist create folder
fs.ensureDirSync(OUTPUT); // same..

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOADS),// destination
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)// file name
  })
});

async function convertFile(inputPath, format) {
  const key = process.env.CLOUDCONVERT_API_KEY; // storing API Key in .env
  console.log("API Key:", key ? "YES" : "NO");
  if (!key) throw new Error("API key not found in .env file");
  
  const headers = { 
    Authorization: `Bearer ${key}`, 
    "Content-Type": "application/json" }; // for cloudconvert auhorization

  // Create job
  const jobData = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify({
      tasks: {
        upload: { operation: "import/upload" },
        convert: { operation: "convert", input: ["upload"], output_format: format },// convertion of input file
        export: { operation: "export/url", input: ["convert"] } // download link for converted file
      }
    })
  }).then(r => r.json());// reply taking from cloudConvert
  
  //Checking wheher CloudConvert job created or not or limit crossed
  if (!jobData.data) {
    const msg = jobData.message || "Job creation failed";
    if (msg.includes("credits")) throw new Error("Out of CloudConvert credits. Check your account at cloudconvert.com/dashboard");
    throw new Error(msg);
  }
  const job = jobData.data;// storing job in job variable

  // uploading files o CloudConvert wait untill the upload are not completed
  const uploadTask = job.tasks.find(t => t.operation === "import/upload"); //from upload 
  const form = new FormData();
  Object.entries(uploadTask.result.form.parameters).forEach(([k, v]) => form.append(k, String(v)));
  form.append("file", fs.createReadStream(inputPath));

  await new Promise((res, rej) => {
    form.submit(uploadTask.result.form.url, (err, r) => {
      if (err || r.statusCode >= 400) rej(err || new Error("Upload failed"));
      else { r.resume(); res(); }
    });
  });

  // Poll
  let status;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    status = await fetch(`https://api.cloudconvert.com/v2/jobs/${job.id}`, { headers }).then(r => r.json()).then(d => d.data);
    if (status.status === "finished") break;
    if (status.status === "error") throw new Error("Conversion failed");
  }

  // Download
  const url = status.tasks.find(t => t.operation === "export/url").result.files[0].url;
  return Buffer.from(await fetch(url).then(r => r.arrayBuffer()));
}

app.post("/convert", upload.array("files"), async (req, res) => {
  const jobFolder = path.join(OUTPUT, Date.now().toString());
  try {
    if (!req.files?.length) return res.status(400).json({ error: "No files" });

    const format = (req.body.format || "pdf").toLowerCase();
    fs.ensureDirSync(jobFolder);

    for (const file of req.files) {
      const name = path.basename(file.originalname, path.extname(file.originalname));
      await fs.writeFile(path.join(jobFolder, `${name}.${format}`), await convertFile(file.path, format));
      fs.remove(file.path);
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=converted.zip");

    const zip = archiver("zip", { zlib: { level: 9 } });
    zip.pipe(res);
    zip.directory(jobFolder, false);
    zip.finalize();
    res.on("finish", () => fs.remove(jobFolder));

  } catch (err) {
    console.error("Error:", err.message);
    req.files?.forEach(f => fs.remove(f.path).catch(() => {}));
    fs.remove(jobFolder).catch(() => {});
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok" }));
app.listen(process.env.PORT || 5000, () => console.log("SERVER RUNNING ON PORT 5000"));