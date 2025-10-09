// /routes/testRoutes.js
import express from "express";
import { sendEmail } from "../utils/emailService.js";

const router = express.Router();

router.get("/send-test", async (req, res) => {
  await sendEmail("hansinawodya095@gmail.com", "Test Email", "This is a test email from your project.");
  res.json({ message: "Email sent!" });
});

export default router;
