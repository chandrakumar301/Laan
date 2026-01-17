# ⚡ QUICK REFERENCE CARD

## 🚀 Deployment (TL;DR)

```bash
# 1. Supabase: Run migration
# Copy & run: supabase/migrations/006_add_wallet_and_transactions.sql

# 2. Restart
npm run start:server
npm run dev

# 3. Test
Login → Apply Loan → Pay → Check Email
```

---

## 💾 Database Tables

```sql
-- user_wallets
user_email | wallet_limit | wallet_spent | wallet_remaining | is_blocked

-- transactions
user_email | loan_id | transaction_type | amount | status | created_at

-- payment_reminders
user_email | loan_id | order_id | expired_at | is_expired
```

---

## 🔗 New API Endpoints

| Endpoint                   | Method | Purpose                                 |
| -------------------------- | ------ | --------------------------------------- |
| `/api/wallet/:email`       | GET    | Get user wallet                         |
| `/api/transactions/:email` | GET    | Get transaction history                 |
| `/api/admin/extend-wallet` | POST   | Admin extends limit                     |
| `/api/create-order`        | POST   | _(Updated)_ Wallet check + reminder     |
| `/api/verify-payment`      | POST   | _(Updated)_ Update wallet + transaction |

---

## 📧 Emails Sent

1. **Order Created:** "⏰ You have 1 hour left"
2. **Payment Success:** "✅ Payment Successful" (user + admin)
3. **Payment Timeout:** "⚠️ Account Locked" (admin)
4. **Wallet Extended:** "🎉 Wallet Limit Extended" (user)

---

## 🔐 Wallet Logic

```
New User: wallet_limit = ₹100

Before Payment:
✓ Check: is_blocked?
✓ Check: wallet_remaining > 0?

After Payment:
✓ wallet_spent += amount
✓ wallet_remaining -= amount

If wallet_remaining <= 0:
✗ Block next payment

Admin can:
✓ extend-wallet(+₹100) → increases limit & unblocks
```

---

## ⏰ Payment Reminder

```
t=0:00    → Payment initiated
          → Email sent + Timer started

t=0:00-1:00 → User can complete payment

t=1:00    → If not completed:
          → Account locked (is_blocked = true)
          → Admin emailed notification
```

---

## 📊 Dashboard Changes

```
BEFORE:
- Just loan info

AFTER:
+ Wallet Balance (stat card)
+ Locked Account Alert (if is_blocked)
+ Transaction History (last 5)
+ Wallet checks before payment
```

---

## 🧪 Quick Test

```bash
# Terminal 1
npm run start:server

# Terminal 2
npm run dev

# Browser
1. Login
2. Apply for loan
3. Click Pay
4. Check email → Should have 1-hour reminder
5. Complete payment
6. Check transaction history → Should show "completed"
```

---

## 🔧 Environment Variables

```
VITE_API_BASE_URL=https://laan.onrender.com  (required)
ADMIN_EMAIL=edufund@gmail.com                (required)
RAZORPAY_KEY_ID=...                          (required)
RAZORPAY_KEY_SECRET=...                      (required)
RESEND_API_KEY=...                           (required)
SUPABASE_SERVICE_KEY=...                     (required)
```

---

## 📁 Files Changed

**Backend:**

- `server/index.js` → +170 lines (wallet, reminders, transactions)

**Frontend:**

- `Dashboard.tsx` → +100 lines (wallet UI, transaction history)
- `Chat.tsx` → 1 line (HTTPS)
- `LoanApplication.tsx` → 1 line (HTTPS)
- `AdminDashboard.tsx` → 10 lines (HTTPS helper)
- `App.css` → +50 lines (animations)

**Database:**

- `006_add_wallet_and_transactions.sql` → New migration

---

## ❌ Common Issues & Quick Fixes

| Issue                               | Fix                                    |
| ----------------------------------- | -------------------------------------- |
| "Wallet not found"                  | Run migration in Supabase              |
| No email sent                       | Check RESEND_API_KEY in .env           |
| Empty transaction history           | Wait 5 sec after payment, then refresh |
| "Cannot read property 'is_blocked'" | Restart backend                        |
| Account locked but can pay          | Clear browser cache                    |

---

## ✅ Readiness Checklist

- [ ] Migration applied to Supabase
- [ ] Backend restarted
- [ ] Frontend loads
- [ ] Can login
- [ ] Wallet shows ₹100
- [ ] Can apply for loan
- [ ] Can initiate payment
- [ ] Email received
- [ ] Can complete payment
- [ ] Transaction appears in history
- [ ] Wallet updated

---

## 📈 Monitoring

**Daily Check:**

- Render logs for errors
- Email delivery working

**Weekly Check:**

- User wallets reasonable
- No stuck payment reminders
- Locked accounts being unlocked

---

## 🎯 Success Metrics

- User can pay → Yes/No
- Reminder email sent → Yes/No
- Transaction recorded → Yes/No
- Wallet updated → Yes/No
- Admin can extend → Yes/No
- Account locks after 1hr → Yes/No

---

## 📞 Support

| Question           | Answer       | Document                    |
| ------------------ | ------------ | --------------------------- |
| What was added?    | 5 features   | README_FEATURES.md          |
| How do I set up?   | Step-by-step | SETUP_GUIDE.md              |
| How do I test?     | Checklist    | PRE_DEPLOYMENT_CHECKLIST.md |
| How does API work? | Examples     | API_DOCUMENTATION.md        |
| Show visually?     | Diagrams     | VISUAL_SUMMARY.md           |

---

## 🚀 Deployment Steps

```
1. Apply migration
   Supabase SQL Editor → Run 006_*.sql

2. Update env (already done)
   Check VITE_API_BASE_URL, ADMIN_EMAIL

3. Push to GitHub
   git add . && git commit -m "Add wallet/reminder features"

4. Render auto-deploys
   Or manually trigger

5. Test in production
   Login → Pay → Check email → Verify transaction

6. Monitor
   Check Render logs
   Monitor email delivery
```

---

**Implementation Status:** ✅ COMPLETE
**Deployment Status:** 🚀 READY
**Documentation:** 📚 COMPREHENSIVE (7 files)
