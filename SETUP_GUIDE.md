# 🚀 SETUP GUIDE: Run the New Features

## Step 1: Apply Supabase Migration

1. Go to your Supabase dashboard
2. Click on "SQL Editor"
3. Create a new query
4. Copy the contents of `supabase/migrations/006_add_wallet_and_transactions.sql`
5. Execute the query

**Expected output:** All tables created successfully

---

## Step 2: Verify Environment Variables

Check `.env` has these (they should already be there):

```
VITE_API_BASE_URL=https://laan.onrender.com
ADMIN_EMAIL=edufund@gmail.com
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RESEND_API_KEY=...
```

---

## Step 3: Restart Backend

```bash
npm run start:server
```

You should see:

```
✓ All wallet/transaction middleware loaded
✓ Payment reminder system ready
✓ New APIs available: /api/wallet, /api/transactions, /api/admin/extend-wallet
```

---

## Step 4: Restart Frontend

```bash
npm run dev
```

You should see:

```
✓ Dashboard with transaction history
✓ Wallet balance displayed
✓ Animations working
```

---

## 🧪 Quick Test Flow

1. **Login** to dashboard
2. **Check wallet balance** - Should show ₹100 remaining
3. **Click "Pay Now"** for active loan
4. **Check email** - Should get 1-hour reminder
5. **Complete payment** in Razorpay window
6. **Check transaction history** - Should show "completed" status
7. **Check wallet** - Should show updated balance

---

## ⚠️ If Payment Shows "Wallet Limit Exceeded"

This means user hit the ₹100 limit. Admin can extend:

**Via Dashboard (Admin):**

- Navigate to admin panel (not yet in UI, but API exists)
- Call `/api/admin/extend-wallet` with:
  ```json
  {
    "userEmail": "user@example.com",
    "additionalAmount": 100,
    "adminEmail": "edufund@gmail.com"
  }
  ```

**User will get email:** "🎉 Your wallet limit has been extended to ₹200"

---

## ⏰ If 1-Hour Timer Expires

If user doesn't complete payment within 1 hour:

- User's account is **automatically locked**
- Admin gets **email notification**
- User sees **red alert** on dashboard: "Your account is locked"

To unlock:

- Admin extends wallet (which also unblocks)
- Or admin can manually update `user_wallets.is_blocked = false` in Supabase

---

## 📊 Database Queries (If Needed)

View all user wallets:

```sql
SELECT * FROM user_wallets;
```

View all transactions:

```sql
SELECT * FROM transactions ORDER BY created_at DESC;
```

View payment reminders:

```sql
SELECT * FROM payment_reminders WHERE is_expired = false;
```

---

## 🔍 Troubleshooting

**"Wallet not found" error:**
→ Wallet table not migrated. Run Step 1 again.

**Payment reminder email not sent:**
→ Check Resend API key in `.env`
→ Check admin email is correct

**Transaction history shows empty:**
→ Transactions are only created after payment initiated
→ Wait 5 seconds after clicking "Pay Now"

**Account locked but can still pay:**
→ Clear browser cache
→ Wallet check might be cached
→ Restart backend: `npm run start:server`

---

## 📝 Files Modified

**Backend:**

- `server/index.js` - Added all wallet/reminder/transaction logic

**Frontend:**

- `src/pages/Dashboard.tsx` - Added wallet checks, transaction history UI
- `src/pages/Chat.tsx` - HTTPS upgrade for Socket.IO
- `src/pages/LoanApplication.tsx` - HTTPS upgrade for API calls
- `src/pages/AdminDashboard.tsx` - HTTPS upgrade + helper function
- `src/App.css` - Added animations

**Database:**

- `supabase/migrations/006_add_wallet_and_transactions.sql` - New tables

---

## ✨ What's New

✅ Email notifications (1-hour reminder, payment success, account locked, limit extended)
✅ Wallet limits (₹100 per user)
✅ Automatic account locking after 1 hour
✅ Full transaction history with UI
✅ Admin controls to extend limits
✅ UI animations and polish
✅ All Render-compatible

**No existing functionality was changed or removed.**
