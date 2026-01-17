# 📡 NEW API ENDPOINTS

## 1. GET /api/wallet/:userEmail

**Purpose:** Fetch user's wallet information

**Request:**

```
GET /api/wallet/user@example.com
```

**Response:**

```json
{
  "ok": true,
  "wallet": {
    "id": "uuid",
    "user_email": "user@example.com",
    "wallet_limit": 100.0,
    "wallet_spent": 45.5,
    "wallet_remaining": 54.5,
    "is_blocked": false,
    "created_at": "2024-01-16T10:00:00Z",
    "updated_at": "2024-01-16T10:30:00Z"
  }
}
```

---

## 2. GET /api/transactions/:userEmail

**Purpose:** Fetch all transactions for a user

**Request:**

```
GET /api/transactions/user@example.com
```

**Response:**

```json
{
  "ok": true,
  "transactions": [
    {
      "id": "uuid",
      "user_email": "user@example.com",
      "loan_id": "loan-123",
      "transaction_type": "debit",
      "amount": 5000.0,
      "status": "completed",
      "description": "Payment initiated for loan loan-123",
      "razorpay_payment_id": "pay_29QQoUBi66xm2f",
      "razorpay_order_id": "order_9A33XWu170gUtm",
      "created_at": "2024-01-16T10:30:00Z"
    },
    {
      "id": "uuid",
      "user_email": "user@example.com",
      "loan_id": null,
      "transaction_type": "credit",
      "amount": 100.0,
      "status": "completed",
      "description": "Wallet limit extended by admin",
      "razorpay_payment_id": null,
      "razorpay_order_id": null,
      "created_at": "2024-01-16T09:00:00Z"
    }
  ]
}
```

**Query Parameters:**

- None (but you can filter by date in frontend)

---

## 3. POST /api/create-order

**Purpose:** Create Razorpay order + start 1-hour reminder + record transaction

**Changes from Original:**

- Now checks wallet access first
- Blocks if `wallet.is_blocked = true`
- Blocks if `wallet.wallet_remaining <= 0`
- Starts 1-hour payment timer automatically
- Creates pending transaction record
- Sends email reminder to user

**Request:**

```json
{
  "loanId": "loan-123",
  "studentId": "user@example.com",
  "amount": 5000
}
```

**Response:**

```json
{
  "ok": true,
  "order": {
    "id": "order_9A33XWu170gUtm",
    "entity": "order",
    "amount": 500000,
    "amount_paid": 0,
    "amount_due": 500000,
    "currency": "INR",
    "receipt": "loan_loan-123_1705405200000",
    "offer_id": null,
    "status": "created",
    "attempts": 0,
    "notes": {
      "loanId": "loan-123",
      "studentId": "user@example.com"
    },
    "created_at": 1705405200
  },
  "key": "rzp_test_S3iZp2kdDjx7FE"
}
```

**Errors:**

```json
{
  "error": "Wallet limit exceeded"
}
```

```json
{
  "error": "Account blocked"
}
```

---

## 4. POST /api/verify-payment

**Purpose:** Verify payment signature + update transaction + update wallet

**Changes from Original:**

- Updates transaction status to "completed"
- Updates wallet_spent amount
- Sends confirmation to user AND admin
- Auto-completes payment reminder (deletes from in-memory store)

**Request:**

```json
{
  "razorpay_order_id": "order_9A33XWu170gUtm",
  "razorpay_payment_id": "pay_29QQoUBi66xm2f",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a",
  "loanId": "loan-123",
  "studentId": "user@example.com",
  "amount": 5000
}
```

**Response:**

```json
{
  "ok": true,
  "payment": {
    "id": "uuid",
    "loan_id": "loan-123",
    "student_id": "user@example.com",
    "amount": 5000,
    "razorpay_order_id": "order_9A33XWu170gUtm",
    "razorpay_payment_id": "pay_29QQoUBi66xm2f",
    "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a",
    "status": "success",
    "paid_at": "2024-01-16T10:30:00Z"
  }
}
```

---

## 5. POST /api/admin/extend-wallet

**Purpose:** Admin extends user's wallet limit (and unblocks if locked)

**Request:**

```json
{
  "userEmail": "user@example.com",
  "additionalAmount": 100,
  "adminEmail": "edufund@gmail.com"
}
```

**Response:**

```json
{
  "ok": true,
  "wallet": {
    "id": "uuid",
    "user_email": "user@example.com",
    "wallet_limit": 200.0,
    "wallet_spent": 45.5,
    "wallet_remaining": 154.5,
    "is_blocked": false,
    "created_at": "2024-01-16T10:00:00Z",
    "updated_at": "2024-01-16T11:00:00Z"
  }
}
```

**Error (Unauthorized):**

```json
{
  "error": "Unauthorized"
}
```

**Error (User not found):**

```json
{
  "error": "User wallet not found"
}
```

---

## Email Notifications Sent

### 1️⃣ Payment Reminder (Sent when order created)

```
To: user@example.com
Subject: ⏰ Payment Reminder: 1 Hour Left

Body:
You have 1 hour left to complete your payment for Loan loan-123.
Please complete the payment before it expires.
If you don't complete the payment in time, your account will be temporarily locked.
```

### 2️⃣ Payment Success (Sent when payment verified)

```
To: user@example.com
Subject: ✅ Payment Successful

Body:
Your payment of ₹5000 has been received.
Payment ID: pay_29QQoUBi66xm2f
Loan ID: loan-123
Thank you for completing your payment on time!
```

### 3️⃣ Admin Notification (Sent when payment verified)

```
To: edufund@gmail.com
Subject: 💰 Payment Received

Body:
Student: user@example.com
Amount: ₹5000
Loan ID: loan-123
Payment ID: pay_29QQoUBi66xm2f
```

### 4️⃣ Payment Expired (Sent after 1 hour if not completed)

```
To: edufund@gmail.com
Subject: ⚠️ Payment Expired - User Locked

Body:
User user@example.com did not complete payment for Loan loan-123 within 1 hour.
Account has been automatically locked.
Action Required: Review and unlock manually if needed.
```

### 5️⃣ Wallet Extended (Sent when admin extends wallet)

```
To: user@example.com
Subject: 🎉 Wallet Limit Extended

Body:
Your wallet limit has been increased by ₹100.
New Limit: ₹200
You can now make more transactions.
```

---

## Database Schema

### user_wallets Table

```sql
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  wallet_limit DECIMAL(10, 2) DEFAULT 100.00,
  wallet_spent DECIMAL(10, 2) DEFAULT 0.00,
  wallet_remaining DECIMAL(10, 2) DEFAULT 100.00,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### transactions Table

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  loan_id TEXT,
  transaction_type TEXT,  -- 'credit', 'debit', 'payment'
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
  description TEXT,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### payment_reminders Table

```sql
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  loan_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  reminder_sent_at TIMESTAMPTZ DEFAULT NOW(),
  expired_at TIMESTAMPTZ,
  is_expired BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Frontend Integration

### Dashboard Component

- Fetches wallet info on mount: `GET /api/wallet/:email`
- Fetches transactions on mount: `GET /api/transactions/:email`
- Checks wallet before payment
- Shows wallet balance in stats
- Shows transaction history (last 5)
- Shows locked account alert

### Payment Flow

1. User clicks "Pay Now"
2. Frontend checks: Is account blocked? Is wallet remaining > 0?
3. Frontend calls: `POST /api/create-order`
4. Backend checks wallet again, creates order, starts 1-hour timer
5. Backend returns order details
6. Frontend opens Razorpay window
7. User completes payment
8. Razorpay returns to frontend
9. Frontend calls: `POST /api/verify-payment`
10. Backend verifies signature, updates transaction, updates wallet
11. Frontend updates UI with success message

---

## Testing Checklist

- [ ] Wallet fetched correctly
- [ ] Transactions displayed in order
- [ ] Payment blocked if wallet_spent >= wallet_limit
- [ ] Payment blocked if is_blocked = true
- [ ] 1-hour reminder email sent
- [ ] Payment success email sent to user
- [ ] Payment notification email sent to admin
- [ ] Transaction marked as completed
- [ ] Wallet balance updated
- [ ] Admin can extend wallet
- [ ] User unblocked after wallet extension
- [ ] Account locked after 1 hour with admin notification
