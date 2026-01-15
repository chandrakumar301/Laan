import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* =========================
   RESEND CONFIG
========================= */
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: "EduFund <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return false;
    }

    console.log("Email sent:", data);
    return true;
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}

/* =========================
   SUPABASE CONFIG
========================= */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* =========================
   HEALTH
========================= */
app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

/* =========================
   TEST EMAIL
========================= */
app.post("/api/test-email", async (req, res) => {
  const to = req.body.to || process.env.ADMIN_EMAIL;

  const sent = await sendEmail({
    to,
    subject: "✅ Resend Test Email",
    html: `
      <h2>Resend is working</h2>
      <p>This email was sent successfully.</p>
    `,
  });

  if (!sent) return res.status(500).json({ error: "email failed" });
  res.json({ ok: true });
});

/* =========================
   APPLY LOAN
========================= */
app.post("/api/apply-loan", async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      college,
      amount,
      reason,
      account_number,
      account_holder_name,
      bank_name,
      ifsc_code,
    } = req.body;

    if (
      !full_name ||
      !email ||
      !phone ||
      !college ||
      !amount ||
      !reason ||
      !account_number ||
      !account_holder_name ||
      !ifsc_code
    ) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (Number(amount) > 1500) {
      return res.status(400).json({ error: "Max ₹1500 allowed" });
    }

    const applied_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("loans")
      .insert([
        {
          student_name: full_name,
          student_email: email,
          phone,
          college,
          amount,
          reason,
          account_number,
          account_holder_name,
          bank_name,
          ifsc_code,
          status: "applied",
          applied_at,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "DB insert failed" });
    }

    /* Admin Email */
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "📄 New Loan Application",
      html: `
        <h3>New Loan Request</h3>
        <p><b>Name:</b> ${full_name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Amount:</b> ₹${amount}</p>
        <p><b>Reason:</b> ${reason}</p>
        <p><b>Loan ID:</b> ${data.id}</p>
      `,
    });

    /* Student Email */
    await sendEmail({
      to: email,
      subject: "Loan Application Submitted",
      html: `
        <h3>Hi ${full_name},</h3>
        <p>Your loan request has been submitted.</p>
        <p><b>Loan ID:</b> ${data.id}</p>
        <p>You will get updates soon.</p>
      `,
    });

    res.json({ ok: true, loan: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

/* =========================
   ROOT
========================= */
app.get("/", (_, res) => {
  res.json({ ok: true, message: "EduFund backend running" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
