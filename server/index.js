import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
const app = express();
dotenv.config();
app.use(cors({
  origin: "https://laan-six.vercel.app", // your frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// capture raw body for webhook verification
app.use(cors())
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

// Helper: fetch Supabase user from access token
async function getUserFromToken(token) {
  try {
    if (!token) return null;
    const url = SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user";
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user;
  } catch (err) {
    console.error("getUserFromToken error", err);
    return null;
  }
}

// Middleware: require admin user (checks email against ADMIN_EMAIL)
async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "missing auth token" });
    const user = await getUserFromToken(token);
    if (!user || !user.email)
      return res.status(401).json({ error: "invalid token" });
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || user.email !== adminEmail)
      return res.status(403).json({ error: "admin access required" });
    req.adminUser = user;
    next();
  } catch (err) {
    console.error("requireAdmin error", err);
    res.status(500).json({ error: "server error" });
  }
}

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

    // send acknowledgement to student immediately
    try {
      if (data && data.student_email) {
        await sendEventEmail("application_submitted", data.student_email, {
          name: data.student_name,
          loanId: data.id,
        });
      }
    } catch (err) {
      console.error("failed to send acknowledgement to student", err);
    }

    // schedule automatic approval and notify user after 20 minutes
    try {
      const delayMs = 20 * 60 * 1000; // 20 minutes
      setTimeout(async () => {
        try {
          // fetch latest loan state
          const { data: latestLoan, error: fetchErr } = await supabase
            .from("loans")
            .select("*")
            .eq("id", data.id)
            .single();
          if (fetchErr || !latestLoan) {
            console.error("auto-approve: failed to fetch loan", fetchErr);
            return;
          }

          // if already approved/rejected/paid/disbursed, skip
          if (
            ["approved", "rejected", "disbursed", "paid", "OVERDUE"].includes(
              latestLoan.status
            )
          )
            return;

          const approvedAt = new Date().toISOString();
          const { data: updated, error: updErr } = await supabase
            .from("loans")
            .update({ status: "approved", approved_at: approvedAt })
            .eq("id", data.id)
            .select()
            .single();
          if (updErr) {
            console.error("auto-approve: failed to update loan", updErr);
            return;
          }

          // log history
          try {
            await supabase.from("loan_history").insert([
              {
                loan_id: data.id,
                status: "approved",
                note: "Auto-approved after 20 minutes",
                changed_by: "system",
                created_at: approvedAt,
              },
            ]);
          } catch (err) {
            console.error("auto-approve: failed to insert history", err);
          }

          // notify student
          try {
            if (updated && updated.student_email) {
              await sendEventEmail("approved", updated.student_email, {
                name: updated.student_name,
                loanId: data.id,
                dueDate: updated.due_date,
              });
            }
          } catch (err) {
            console.error("auto-approve: failed to notify student", err);
          }

          // notify admin
          try {
            const adminEmail2 = process.env.ADMIN_EMAIL;
            if (adminEmail2)
              await logEmail(
                adminEmail2,
                "Loan Auto-Approved",
                `Loan ${data.id} auto-approved by system.`,
                "sent"
              );
          } catch (err) {
            console.error("auto-approve: failed to notify admin", err);
          }
        } catch (err) {
          console.error("auto-approve timer error", err);
        }
      }, delayMs);
    } catch (err) {
      console.error("failed to schedule auto-approval", err);
    }

    res.json({ ok: true, loan: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "apply failed" });
  }
});

// Prevent new applications when user has overdue loans and provide user's loan history
app.get("/api/my-loans", async (req, res) => {
  try {
    const email = String(req.query.email || "");
    if (!email) return res.status(400).json({ error: "email required" });

    // fetch loans for user
    const { data: loans, error } = await supabase
      .from("loans")
      .select("*")
      .eq("student_email", email)
      .order("applied_at", { ascending: false });
    if (error) return res.status(500).json({ error: "failed to fetch loans" });

    // for each loan compute payments sum and remaining amount, days left
    const enriched = await Promise.all(
      (loans || []).map(async (loan) => {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount,payment_status")
          .eq("loan_id", loan.id);
        const paid = (payments || [])
          .filter((p) => p.payment_status === "success")
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const remaining = Number(loan.amount || 0) - paid;
        let daysLeft = null;
        if (loan.due_date) {
          const due = new Date(loan.due_date);
          const now = new Date();
          const ms = due.getTime() - now.getTime();
          daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
        }
        return { ...loan, paid, remaining, daysLeft };
      })
    );

    res.json({ ok: true, loans: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// loan history
app.get("/api/loan/:id/history", async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase
      .from("loan_history")
      .select("*")
      .eq("loan_id", id)
      .order("created_at", { ascending: true });
    if (error)
      return res.status(500).json({ error: "failed to fetch history" });
    res.json({ ok: true, history: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// create payment record (student/admin)
app.post("/api/payments", async (req, res) => {
  try {
    const {
      loanId,
      amount,
      payment_method,
      transaction_reference,
      payment_date,
      payment_status,
    } = req.body;
    if (!loanId || !amount)
      return res.status(400).json({ error: "loanId and amount required" });

    // fetch loan
    const { data: loan } = await supabase
      .from("loans")
      .select("*")
      .eq("id", loanId)
      .single();
    if (!loan) return res.status(404).json({ error: "loan not found" });

    // compute existing successful payments
    const { data: payments } = await supabase
      .from("payments")
      .select("amount,payment_status")
      .eq("loan_id", loanId);
    const paid = (payments || [])
      .filter((p) => p.payment_status === "success")
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    if (paid + Number(amount) > Number(loan.amount || 0)) {
      return res.status(400).json({ error: "Payment exceeds loan amount" });
    }

    const { data, error } = await supabase
      .from("payments")
      .insert([
        {
          loan_id: loanId,
          amount: amount,
          payment_method,
          transaction_reference,
          payment_date: payment_date || new Date().toISOString(),
          payment_status: payment_status || "pending",
        },
      ])
      .select()
      .single();
    if (error) {
      console.error("insert payment error", error);
      return res
        .status(500)
        .json({ error: "failed to create payment", detail: error });
    }

    // if payment succeeded and fully paid, mark loan as paid
    if ((payment_status || "pending") === "success") {
      const newPaid = paid + Number(amount);
      if (newPaid >= Number(loan.amount || 0)) {
        await supabase
          .from("loans")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", loanId);
        await supabase.from("loan_history").insert([
          {
            loan_id: loanId,
            status: "paid",
            note: "Loan fully paid",
            changed_by: "system",
            created_at: new Date().toISOString(),
          },
        ]);
        // notify student
        if (loan.student_email)
          await sendEventEmail("payment_success", loan.student_email, {
            name: loan.student_name,
            loanId,
            amount: loan.amount,
          });
      }
      // notify admin of payment
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail)
        await logEmail(
          adminEmail,
          "Payment Received",
          `Payment received for loan ${loanId}: ₹${amount}`,
          "sent"
        );
    }

    res.json({ ok: true, payment: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// due payments for a user
app.get("/api/due-payments", async (req, res) => {
  try {
    const email = String(req.query.email || "");
    if (!email) return res.status(400).json({ error: "email required" });

    const { data: loans } = await supabase
      .from("loans")
      .select("*")
      .eq("student_email", email)
      .order("due_date", { ascending: true });

    const result = await Promise.all(
      (loans || []).map(async (loan) => {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount,payment_status")
          .eq("loan_id", loan.id);
        const paid = (payments || [])
          .filter((p) => p.payment_status === "success")
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        const remaining = Number(loan.amount || 0) - paid;
        const isOverdue =
          loan.due_date &&
          new Date() > new Date(loan.due_date) &&
          remaining > 0;
        return { ...loan, paid, remaining, isOverdue };
      })
    );

    res.json({ ok: true, duePayments: result.filter((r) => r.remaining > 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
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
    }
    if (status === "disbursed") {
      const disbursed_at = new Date().toISOString();
      updates.disbursed_at = disbursed_at;
      // set due_date = disbursed_at + 2 days (strict 2-day recovery period)
      const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      updates.due_date = due.toISOString();
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

    // record status change in loan_history
    try {
      const changedBy = req.body.adminEmail || "admin";
      await supabase.from("loan_history").insert([
        {
          loan_id: loanId,
          status,
          note: `Status changed to ${status}`,
          changed_by: changedBy,
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
