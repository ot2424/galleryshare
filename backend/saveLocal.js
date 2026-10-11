import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

router.post("/save-local/:galleryId", (req, res) => {
  const { galleryId } = req.params;

  if (!req.headers["x-filename"]) {
    return res.status(400).json({ error: "Filename missing" });
  }

  const filename = req.headers["x-filename"].replace(/\s+/g, "_");
  const folder = path.join("/root/PhotoShare/backend/temp", galleryId);

  fs.mkdirSync(folder, { recursive: true });

  const filePath = path.join(folder, filename);
  const write = fs.createWriteStream(filePath);

  req.pipe(write);

  write.on("finish", () => {
    console.log("💾 Lokal gespeichert:", filename);
    res.json({ success: true, filename });
  });

  write.on("error", (err) => {
    console.error("❌ Fehler Local Save:", err);
    res.status(500).json({ error: "Local save failed" });
  });
});

export default router;
