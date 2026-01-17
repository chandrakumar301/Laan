# 📋 PRE-DEPLOYMENT CHECKLIST

## Before Deploying to Render

### 1. Database Setup ✓ DO THIS FIRST

- [ ] Open Supabase dashboard
- [ ] Go to SQL Editor
- [ ] Copy contents of `supabase/migrations/006_add_wallet_and_transactions.sql`
- [ ] Paste and execute
- [ ] Verify 3 tables created (user_wallets, transactions, payment_reminders)
- [ ] Verify 3 indexes created
- [ ] **IMPORTANT:** Do NOT skip this step

### 2. Environment Variables ✓ VERIFY

Check `.env` has:

- [ ] `VITE_API_BASE_URL=https://laan.onrender.com`
- [ ] `VITE_SOCKET_URL=https://laan.onrender.com`
- [ ] `ADMIN_EMAIL=edufund@gmail.com` (or your admin email)
- [ ] `RAZORPAY_KEY_ID=rzp_test_...` or production key
- [ ] `RAZORPAY_KEY_SECRET=...`
- [ ] `RESEND_API_KEY=...`
- [ ] `SUPABASE_SERVICE_KEY=...`
- [ ] `VITE_SUPABASE_URL=...`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY=...`

### 3. Backend Setup ✓

- [ ] All changes in `server/index.js` are present
- [ ] Test locally: `npm run start:server` (should not error)
- [ ] Test health check: `http://localhost:4000/api/health` (should return `{ok: true}`)
- [ ] Test new endpoints locally if possible

### 4. Frontend Setup ✓

- [ ] All changes in `src/pages/Dashboard.tsx` are present
- [ ] Transaction history widget visible
- [ ] Wallet balance shows in stats
- [ ] Locked account alert visible (if wallet.is_blocked)
- [ ] Animations load without errors
- [ ] No TypeScript errors: `npm run build`

### 5. Local Testing ✓

- [ ] Start backend: `npm run start:server`
- [ ] Start frontend: `npm run dev`
- [ ] Login to app
- [ ] Apply for a loan
- [ ] Click "Pay Now"
- [ ] Check console for errors
- [ ] Verify wallet check works (should not error)
- [ ] Look for 1-hour timer in browser console logs

### 6. Render Deployment ✓

#### Backend (Render)

- [ ] Push code to GitHub
- [ ] Render auto-deploys (or manual trigger)
- [ ] Wait for deployment to complete
- [ ] Check logs for errors
- [ ] Test: `curl https://laan.onrender.com/api/health`
- [ ] **Important:** Keep backend running (don't suspend)

#### Frontend (Render)

- [ ] Push code to GitHub
- [ ] Render auto-deploys
- [ ] Wait for deployment to complete
- [ ] Test in browser: navigate to deployed URL
- [ ] Test payment flow end-to-end

### 7. Post-Deployment Tests ✓

#### Email Tests

- [ ] Try payment → check email for 1-hour reminder
- [ ] Complete payment → check email for success
- [ ] Check admin email for payment notification
- [ ] (Wait 1 hour) → check email for timeout notification
- [ ] Admin extends wallet → check user gets extended email

#### Wallet Tests

- [ ] New user should have ₹100 limit
- [ ] Payment should deduct from wallet_remaining
- [ ] Second user should also have ₹100 (isolated)
- [ ] Try payment when wallet_remaining = 0 → should error
- [ ] Admin extends by ₹100 → wallet should increase

#### Transaction Tests

- [ ] After payment, transaction should appear in history
- [ ] Status should show as "completed"
- [ ] Amount should be correct
- [ ] Timestamp should be accurate
- [ ] Multiple transactions should appear in order

#### UI Tests

- [ ] Transaction history widget shows last 5
- [ ] Colors correct (green for credit, red for debit)
- [ ] Status badges show correct colors
- [ ] Wallet balance updates after payment
- [ ] Locked alert shows if `is_blocked = true`
- [ ] Animations play smoothly

---

## Common Issues & Fixes

### 1. "Wallet not found" Error

**Cause:** Migration not applied
**Fix:** Run migration in Supabase (Step 1)

### 2. "Wallet limit exceeded" Error (shouldn't happen yet)

**Cause:** User already made ₹100 in transactions
**Fix:** Admin extends wallet OR create new test user

### 3. No 1-hour reminder email

**Cause:** Resend API key invalid
**Fix:**

- [ ] Check `RESEND_API_KEY` in `.env`
- [ ] Check admin email is correct
- [ ] Check email address is valid
- [ ] Test: Send test email directly via Resend

### 4. Transaction history empty

**Cause:** Transactions not recorded
**Fix:**

- [ ] Initiate payment (gives 5 seconds delay)
- [ ] Refresh page
- [ ] Check database: `SELECT * FROM transactions`

### 5. "Cannot read property 'is_blocked' of null"

**Cause:** Wallet not created for user
**Fix:**

- [ ] This shouldn't happen (wallet created on first check)
- [ ] Restart backend
- [ ] Clear browser cache

### 6. Payment timeout after 1 hour locks account

**Cause:** Works as designed
**Fix:** Admin extends wallet (which unlocks) or manually unblock

---

## Monitoring Checklist

### Daily

- [ ] Check Render logs for errors
- [ ] Test payment flow once
- [ ] Verify emails being sent

### Weekly

- [ ] Check Supabase database size
- [ ] Review transaction logs for patterns
- [ ] Verify locked accounts are being unlocked

### Monthly

- [ ] Export transaction history
- [ ] Review wallet limits (are ₹100 limits sufficient?)
- [ ] Check email delivery rates

---

## Rollback Plan

If something goes wrong:

1. **Database issue:** Restore from Supabase backup
2. **Backend error:** Revert code and redeploy
3. **Frontend error:** Clear cache, hard refresh
4. **Payment stuck:** Check payment_reminders table, manually update if needed

---

## Success Criteria

✅ All checks pass when:

- User can login
- User can apply for loan
- User can initiate payment
- User receives 1-hour reminder email
- User can complete payment via Razorpay
- Transaction appears in history within 5 seconds
- Wallet balance updates correctly
- Admin can extend wallet
- Account locks after 1 hour timeout
- Admin can unlock account

---

## Contact

If issues arise:

1. Check `.env` variables
2. Check Supabase tables exist
3. Check Render logs
4. Check browser console for errors
5. Test locally first before production

---

## Notes for Future Maintenance

- Wallet limit (₹100) is configurable in `server/index.js`
- 1-hour timer is configurable (line: `60 * 60 * 1000`)
- Email templates are in `server/index.js` (can customize)
- Admin email is in `.env` as `ADMIN_EMAIL`
