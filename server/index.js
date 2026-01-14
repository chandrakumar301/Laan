import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

// capture raw body for webhook verification
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  console.error(
    "Missing VITE_SUPABASE_URL in environment. Set it in .env as VITE_SUPABASE_URL=your_supabase_url"
  );
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_KEY in environment. Add your Supabase service role key to .env as SUPABASE_SERVICE_KEY=your_service_key"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

// Verify SMTP transporter on startup to surface configuration issues early
transporter
  .verify()
  .then(() => console.log("SMTP transporter verified"))
  .catch((err) => console.error("SMTP transporter verify failed", err));

async function logEmail(to, subject, body, status = "sent") {
  try {
    await supabase
      .from("email_logs")
      .insert([{ to_email: to, subject, body, status }]);
  } catch (err) {
    console.error("Failed to log email", err);
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Test email endpoint: POST { to?: string }
app.post("/api/test-email", async (req, res) => {
  try {
    const to = req.body?.to || process.env.ADMIN_EMAIL;
    const subject = "EduFund test email";
    const text = `Test email sent at ${new Date().toISOString()}`;

    if (!to) return res.status(400).json({ error: "no recipient specified" });

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to,
          subject,
          text,
        });
        console.log("Test email sent", info);
        await logEmail(to, subject, text, "sent");
        return res.json({ ok: true, info });
      } catch (err) {
        console.error("Test email failed", err);
        await logEmail(to, subject, text, "failed");
        return res
          .status(500)
          .json({ error: "failed to send test email", detail: String(err) });
      }
    }

    await logEmail(to, subject, text, "nodemailer_not_configured");
    res.status(500).json({ error: "transporter not configured" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// Get loans (admin)
app.get("/api/loans", async (req, res) => {
  try {
    const status = req.query.status;
    let query = supabase.from("loans").select("*");
    if (status && typeof status === "string")
      query = query.eq("status", status);
    const { data, error } = await query.order("applied_at", {
      ascending: false,
    });
    if (error) return res.status(500).json({ error: "failed to fetch loans" });
    res.json({ loans: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

// Endpoint: apply for a loan (students)
app.post("/api/apply-loan", async (req, res) => {
  try {
    console.log("/api/apply-loan request body:", req.body);
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

    if (!full_name || !email || !phone || !college || !amount || !reason) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Bank details validation: account_number, account_holder_name, ifsc_code required
    if (!account_number || !account_holder_name || !ifsc_code) {
      return res.status(400).json({ error: "Missing bank account details" });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Enforce maximum ₹1500
    if (numericAmount > 1500) {
      return res.status(400).json({ error: "Maximum loan amount is ₹1500" });
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
          amount: numericAmount,
          reason,
          account_number,
          account_holder_name,
          bank_name: bank_name || null,
          ifsc_code,
          status: "applied",
          applied_at,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error", error);
      // return detailed error for debugging (don't expose in production)
      return res
        .status(500)
        .json({ error: "Failed to create application", detail: error });
    }

    // Send email to admin
    const adminEmail = process.env.ADMIN_EMAIL || "edufund0099@gmail.com";
    const subject = "New Student Loan Application – Review Required";
    const body = `Student name: ${full_name}\nEmail: ${email}\nPhone: ${phone}\nCollege: ${college}\nLoan amount: ₹${numericAmount}\nReason: ${reason}\n\nBank details:\nAccount holder: ${account_holder_name}\nAccount number: ${account_number}\nIFSC: ${ifsc_code}\nBank name: ${
      bank_name || "(not provided)"
    }\n\nLoan ID: ${data.id}`;

    try {
      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to: adminEmail,
          subject,
          text: body,
        });
        console.log("Admin email sent", info);
        await logEmail(adminEmail, subject, body, "sent");
      } else {
        await logEmail(adminEmail, subject, body, "nodemailer_not_configured");
      }
    } catch (err) {
      console.error("Admin email send failed", err);
      await logEmail(adminEmail, subject, body, "failed");
    }

    // record application event in loan_history
    try {
      await supabase.from("loan_history").insert([
        {
          loan_id: data.id,
          status: "applied",
          note: "Application submitted",
          changed_by: "student",
          created_at: applied_at,
        },
      ]);
    } catch (err) {
      console.error("failed to insert loan_history for application", err);
    }

    res.json({ ok: true, loan: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "apply failed" });
  }
});

// send emails for events: registration, application submitted, status change, disbursed
async function sendEventEmail(type, toEmail, meta = {}) {
  let subject = "";
  let text = "";

  switch (type) {
    case "registration":
      subject = "Welcome to Student Loan Portal";
      text = `Hi ${
        meta.name || "Student"
      },\n\nThanks for registering. Please verify your email and complete your profile to apply for loans.\n\nBest,\nStudent Loan Team`;
      break;
    case "application_submitted":
      subject = "Loan Application Submitted";
      text = `Hi ${
        meta.name || "Student"
      },\n\nWe have received your loan application (Loan ID: ${
        meta.loanId
      }). Our team will review and get back to you soon.\n\nBest,\nStudent Loan Team`;
      break;
    case "approved":
      subject = "Loan Approved";
      text = `Hi ${
        meta.name || "Student"
      },\n\nCongratulations — your loan (ID: ${
        meta.loanId
      }) has been approved. Repayment deadline is ${
        meta.dueDate
      }.\n\nBest,\nStudent Loan Team`;
      break;
    case "rejected":
      subject = "Loan Application Update";
      text = `Hi ${
        meta.name || "Student"
      },\n\nWe are sorry to inform you that your loan application (ID: ${
        meta.loanId
      }) was not approved. For details, please contact support.\n\nBest,\nStudent Loan Team`;
      break;
    case "disbursed":
      subject = "Loan Disbursed";
      text = `Hi ${meta.name || "Student"},\n\nYour loan (ID: ${
        meta.loanId
      }) has been disbursed. Amount: ${meta.amount}. Repayment deadline: ${
        meta.dueDate
      }.\n\nBest,\nStudent Loan Team`;
      break;
    case "repayment_reminder":
      subject = "Repayment Reminder";
      text = `Hi ${
        meta.name || "Student"
      },\n\nThis is a friendly reminder to repay your loan (ID: ${
        meta.loanId
      }). The repayment deadline is ${
        meta.dueDate
      }. Please complete payment to avoid overdue status.\n\nBest,\nStudent Loan Team`;
      break;
    case "overdue":
      subject = "Loan Overdue Notice";
      text = `Hi ${meta.name || "Student"},\n\nYour loan (ID: ${
        meta.loanId
      }) is now overdue. Please repay as soon as possible to avoid further action.\n\nBest,\nStudent Loan Team`;
      break;
    case "payment_success":
      subject = "Payment Successful";
      text = `Hi ${
        meta.name || "Student"
      },\n\nWe have received your payment for loan (ID: ${
        meta.loanId
      }). Thank you.\n\nBest,\nStudent Loan Team`;
      break;
    case "payment_failed":
      subject = "Payment Failed";
      text = `Hi ${
        meta.name || "Student"
      },\n\nYour recent payment attempt for loan (ID: ${
        meta.loanId
      }) failed. Please try again or contact support.\n\nBest,\nStudent Loan Team`;
      break;
    default:
      subject = meta.subject || "Notification";
      text = meta.text || "";
  }

  try {
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: toEmail,
        subject,
        text,
      });
      await logEmail(toEmail, subject, text, "sent");
    } else {
      await logEmail(toEmail, subject, text, "nodemailer_not_configured");
    }
  } catch (err) {
    console.error("sendEventEmail failed", err);
    await logEmail(toEmail, subject, text, "failed");
  }
}

// Endpoint to update loan status (used by admin UI)
app.post("/api/update-loan-status", async (req, res) => {
  try {
    const { loanId, status, studentEmail } = req.body;
    if (!loanId || !status)
      return res.status(400).json({ error: "Missing params" });

    const updates = { status };
    if (status === "approved") {
      updates.approved_at = new Date().toISOString();
      // set due_date = approved_at + 2 days
      const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      updates.due_date = due.toISOString();
    }
    if (status === "disbursed") {
      updates.disbursed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("loans")
      .update(updates)
      .eq("id", loanId)
      .select()
      .single();
    if (error) {
      console.error("update loan error", error);
      return res.status(500).json({ error: "failed to update loan" });
    }

    // record status change in loan_history
    try {
      await supabase.from("loan_history").insert([
        {
          loan_id: loanId,
          status,
          note: `Status changed to ${status}`,
          changed_by: "admin",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("failed to insert loan_history for status change", err);
    }

    // send email based on status to student
    if (data && data.student_email) {
      if (status === "approved") {
        await sendEventEmail("approved", data.student_email, {
          name: data.student_name,
          loanId,
          dueDate: data.due_date,
        });
      }
      if (status === "rejected") {
        await sendEventEmail("rejected", data.student_email, {
          name: data.student_name,
          loanId,
        });
      }
      if (status === "disbursed") {
        // Student should be informed that admin will disburse via PhonePe
        const text = `Hi ${data.student_name},\n\nYour loan (ID: ${loanId}) has been marked as DISBURSED by the admin. The loan will be credited via PhonePe.\n\nBest,\nStudent Loan Team`;
        await logEmail(data.student_email, "Loan Disbursed", text, "sent");
        if (transporter)
          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: data.student_email,
            subject: "Loan Disbursed",
            text,
          });
      }
    }

    res.json({ ok: true, loan: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to update loan" });
  }
});

// Background scheduler: check for reminders and overdue loans every 15 minutes
setInterval(async () => {
  try {
    // Repayment reminder after 1 day (approved_at + 1 day)
    const { data: reminders } = await supabase
      .from("loans")
      .select("id, student_email, approved_at, due_date")
      .eq("status", "approved")
      .is("paid_at", null);

    if (reminders && reminders.length) {
      const now = new Date();
      for (const loan of reminders) {
        if (!loan.approved_at) continue;
        const approvedAt = new Date(loan.approved_at);
        const msSince = now - approvedAt;

        // after 1 day (24h) send repayment reminder
        if (
          msSince >= 24 * 60 * 60 * 1000 &&
          msSince < 2 * 24 * 60 * 60 * 1000
        ) {
          // send reminder to student
          await sendEventEmail("repayment_reminder", loan.student_email, {
            loanId: loan.id,
            dueDate: loan.due_date,
          });
        }

        // after 2 days mark overdue and notify student and admin
        if (msSince >= 2 * 24 * 60 * 60 * 1000) {
          await supabase
            .from("loans")
            .update({ status: "OVERDUE" })
            .eq("id", loan.id);
          await sendEventEmail("overdue", loan.student_email, {
            loanId: loan.id,
            dueDate: loan.due_date,
          });
          const adminEmail = process.env.ADMIN_EMAIL || "edufund0099@gmail.com";
          const adminText = `Loan ${loan.id} is overdue. Student: ${loan.student_email}`;
          await logEmail(adminEmail, "Loan Overdue Alert", adminText, "sent");
          if (transporter)
            await transporter.sendMail({
              from: process.env.EMAIL_FROM,
              to: adminEmail,
              subject: "Loan Overdue Alert",
              text: adminText,
            });
        }
      }
    }
  } catch (err) {
    console.error("scheduler error", err);
  }
}, 15 * 60 * 1000);

// Razorpay integration removed — repayments are handled manually via PhonePe

// Root route: simple JSON to verify server is up
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({ ok: true, message: "EduFund backend running" });
});

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`Server listening on http://localhost:${port}`)
);

// Admin helper: confirm a user's email using Supabase Admin REST API
app.post("/api/admin/confirm-user", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });

    const adminListUrl = `${SUPABASE_URL.replace(
      /\/$/,
      ""
    )}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;

    const listResp = await fetch(adminListUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!listResp.ok) {
      const text = await listResp.text();
      console.error("Supabase admin list users failed", text);
      return res
        .status(500)
        .json({ error: "failed to lookup user", detail: text });
    }

    const users = await listResp.json();
    if (!Array.isArray(users) || users.length === 0)
      return res.status(404).json({ error: "user not found" });

    const user = users[0];
    const updateUrl = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users/${
      user.id
    }`;

    const patchResp = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ email_confirmed_at: new Date().toISOString() }),
    });

    if (!patchResp.ok) {
      const text = await patchResp.text();
      console.error("Supabase admin update user failed", text);
      return res
        .status(500)
        .json({ error: "failed to update user", detail: text });
    }

    const updated = await patchResp.json();
    res.json({ ok: true, user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// Admin helper: list users (optional ?email=)
app.get("/api/admin/list-users", async (req, res) => {
  try {
    const email = req.query.email;
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users${
      email ? `?email=${encodeURIComponent(String(email))}` : ""
    }`;

    const listResp = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const text = await listResp.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }

    if (!listResp.ok) return res.status(listResp.status).json({ error: body });
    res.json({ ok: true, users: body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// Admin helper: reset a user's password by email
app.post("/api/admin/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ error: "email and newPassword required" });

    const listUrl = `${SUPABASE_URL.replace(
      /\/$/,
      ""
    )}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;

    const listResp = await fetch(listUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!listResp.ok) {
      const t = await listResp.text();
      return res
        .status(500)
        .json({ error: "failed to lookup user", detail: t });
    }

    const users = await listResp.json();
    if (!Array.isArray(users) || users.length === 0)
      return res.status(404).json({ error: "user not found" });

    const user = users[0];
    const updateUrl = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users/${
      user.id
    }`;

    const patchResp = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        password: newPassword,
        email_confirmed_at: new Date().toISOString(),
      }),
    });

    const patchedText = await patchResp.text();
    let patched;
    try {
      patched = JSON.parse(patchedText);
    } catch (e) {
      patched = patchedText;
    }

    if (!patchResp.ok)
      return res.status(patchResp.status).json({ error: patched });
    res.json({ ok: true, user: patched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});
