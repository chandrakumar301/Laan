import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

/* =========================
   EXPRESS APP
========================= */

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* =========================
   HTTP + SOCKET SERVER
========================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* =========================
   SOCKET.IO CHAT
========================= */

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // Join loan-specific room
  socket.on("join_room", ({ loanId, user }) => {
    const room = `loan_${loanId}`;
    socket.join(room);
    console.log(`👤 ${user} joined ${room}`);
  });

  // Receive message and broadcast
  socket.on("send_message", (data) => {
    /*
      data = {
        loanId,
        sender,
        name,
        message,
        time
      }
    */
    const room = `loan_${data.loanId}`;

    io.to(room).emit("receive_message", {
      sender: data.sender,
      name: data.name,
      message: data.message,
      time: data.time,
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

/* =========================
   RESEND EMAIL
========================= */

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "EduFund <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}

/* =========================
   SUPABASE
========================= */

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (_, res) => {
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
          applied_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "DB insert failed" });
    }

    // Admin email (optional)
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "📄 New Loan Application",
      html: `
        <h3>New Loan Request</h3>
        <p>Name: ${full_name}</p>
        <p>Amount: ₹${amount}</p>
        <p>Loan ID: ${data.id}</p>
      `,
    });

    // Student email (optional)
    await sendEmail({
      to: email,
      subject: "Loan Application Submitted",
      html: `
        <p>Hi ${full_name},</p>
        <p>Your loan request has been submitted.</p>
        <p>Loan ID: ${data.id}</p>
      `,
    });

    res.json({ ok: true, loan: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   ROOT
========================= */

app.get("/", (_, res) => {
  res.json({ ok: true, message: "EduFund backend running" });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket running on http://localhost:${PORT}`);
});
