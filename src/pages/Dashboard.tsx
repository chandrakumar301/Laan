import { useState, useEffect } from "react";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: Record<string, string>) => Promise<void>;
  prefill: {
    email: string;
  };
}

interface RazorpayCheckout {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: {
      new (options: RazorpayOptions): RazorpayCheckout;
    };
  }
}
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Calendar,
  FileText,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StatCard } from "@/components/StatCard";
import { LoanStatusBadge } from "@/components/LoanStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LoanApplication {
  id: string;
  amount: number;
  purpose: string;
  status: "pending" | "applied" | "approved" | "rejected" | "disbursed";
  created_at: string;
  tenure_months: number;
  interest_rate: number;
}


interface Transaction {
  id: string;
  amount: number;
  type?: string;
  status: string;
  created_at: string;
  transaction_type: 'credit' | 'debit' | 'approval' | 'disbursement' | 'rejection' | 'loan_request';
  description: string;
}

interface LoanRequest {
  id: string;
  amount: number;
  reason: string;
  status: string;
  applied_at: string;
}

interface Wallet {
  balance: number;
  updated_at: string;
  wallet_remaining?: number;
  is_blocked?: boolean;
  wallet_limit?: number;
}

const Dashboard = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
  // Ensure HTTPS on production to avoid mixed content warnings
  const API_BASE = window.location.protocol === 'https:' && baseUrl.startsWith('http://')
    ? baseUrl.replace('http://', 'https://')
    : baseUrl;
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paidLoans, setPaidLoans] = useState<string[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      setUser({ email: session.user.email || "" });
      setIsLoading(false);

      // Fetch wallet info
      try {
        const walletRes = await fetch(`${API_BASE}/api/wallet/${session.user.email}`);
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          setWallet(walletData.wallet);
        }
      } catch (err) {
        console.error("Wallet fetch error:", err);
      }


      // Fetch transactions
      try {
        const txRes = await fetch(`${API_BASE}/api/transactions/${session.user.email}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          setTransactions(txData.transactions || []);
          // If no transactions, fetch loan requests
          if (!txData.transactions || txData.transactions.length === 0) {
            const loanRes = await fetch(`${API_BASE}/api/loans/${session.user.email}`);
            if (loanRes.ok) {
              const loanData = await loanRes.json();
              console.log(loanData);
              setLoanRequests(loanData.loans || []);
            }
          }
        }
      } catch (err) {
        console.error("Transactions fetch error:", err);
      }

      // Subscribe to real-time transaction updates
      const channel = supabase
        .channel(`user:${session.user.email}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_email=eq.${session.user.email}`
          },
          (payload) => {
            console.log('Real-time transaction update:', payload);
            // Refetch transactions when there's an update
            fetchTransactions(session.user.email || "");
          }
        )
        .subscribe();

      // Fetch loans would go here once we set up the database
      // For now, we'll use mock data
      setLoans([
        {
          id: "1",
          amount: 25000,
          purpose: "Tuition Fees",
          status: "approved",
          created_at: new Date().toISOString(),
          tenure_months: 48,
          interest_rate: 6.5,
        },
      ]);

      return () => {
        channel.unsubscribe();
      };
    };

    const fetchTransactions = async (email: string) => {
      try {
        const txRes = await fetch(`${API_BASE}/api/transactions/${email}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          setTransactions(txData.transactions || []);
        }
      } catch (err) {
        console.error("Transactions fetch error:", err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/login");
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate, API_BASE]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/20" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const totalLoanAmount = loans.reduce((sum, loan) => sum + loan.amount, 0);
  const activeLoan = loans.find((l) => l.status === "approved" || l.status === "disbursed");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Welcome back! 👋
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your loan activity
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Wallet}
            label="Total Loan Amount"
            value={formatCurrency(totalLoanAmount)}
            delay={0}
          />
          <StatCard
            icon={TrendingUp}
            label="Interest Rate"
            value={activeLoan ? `${activeLoan.interest_rate}%` : "—"}
            delay={0.1}
          />
          <StatCard
            icon={Calendar}
            label="Remaining Tenure"
            value={activeLoan ? `${activeLoan.tenure_months} months` : "—"}
            delay={0.2}
          />
          <StatCard
            icon={FileText}
            label="Wallet Balance"
            value={wallet ? `₹${(wallet.wallet_remaining || 0).toFixed(2)}` : "Loading..."}
            delay={0.3}
          />
        </div>

        {/* Wallet Alert */}
        {wallet && wallet.is_blocked && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <p className="text-red-800 font-medium">⚠️ Your account is locked due to payment timeout. Contact admin to unlock.</p>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Active Loan Card */}
            {activeLoan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="gradient-hero text-primary-foreground overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-sm opacity-80">Active Loan</p>
                        <p className="text-3xl font-bold mt-1">
                          {formatCurrency(activeLoan.amount)}
                        </p>
                      </div>
                      <div className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                        {activeLoan.purpose}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-sm opacity-80">Monthly EMI</p>
                        <p className="text-xl font-bold">$552</p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-sm opacity-80">Interest Rate</p>
                        <p className="text-xl font-bold">{activeLoan.interest_rate}%</p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-sm opacity-80">Tenure</p>
                        <p className="text-xl font-bold">{activeLoan.tenure_months}mo</p>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          <span>Next payment due: Feb 15, 2024</span>
                        </div>
                        <Button
                          variant="glass"
                          size="sm"
                          className="border-white/30 text-white hover:bg-white/10"
                          onClick={async () => {
                            if (!user?.email) {
                              toast({ title: "Not signed in", description: "Please sign in to pay.", variant: "destructive" });
                              return;
                            }

                            if (wallet?.is_blocked) {
                              toast({ title: "Account Locked", description: "Your account is locked. Contact admin to unlock.", variant: "destructive" });
                              return;
                            }

                            if (wallet && wallet.wallet_remaining <= 0) {
                              toast({ title: "Wallet Limit Exceeded", description: `You have reached your wallet limit of ₹${wallet.wallet_limit}. Contact admin to increase.`, variant: "destructive" });
                              return;
                            }

                            if (paidLoans.includes(activeLoan?.id || "")) return;

                            setProcessingPayment(true);

                            try {
                              // create order on backend
                              const resp = await fetch(`${API_BASE}/api/create-order`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ loanId: activeLoan?.id, studentId: user.email, amount: activeLoan?.amount })
                              });

                              if (!resp.ok) {
                                const contentType = resp.headers.get("content-type");
                                let errorMsg = "Failed to create order";
                                try {
                                  if (contentType?.includes("application/json")) {
                                    const data = await resp.json();
                                    errorMsg = data.error || errorMsg;
                                  } else {
                                    errorMsg = `Server error (${resp.status}): Backend service may not be deployed`;
                                  }
                                } catch (e) {
                                  errorMsg = `Server error (${resp.status}): Could not parse response`;
                                }
                                throw new Error(errorMsg);
                              }

                              const data = await resp.json();

                              // load razorpay script
                              await new Promise((resolve, reject) => {
                                if (window.Razorpay) return resolve(true);
                                const s = document.createElement("script");
                                s.src = "https://checkout.razorpay.com/v1/checkout.js";
                                s.onload = () => resolve(true);
                                s.onerror = () => reject(new Error("Razorpay script load failed"));
                                document.body.appendChild(s);
                              });

                              const options = {
                                key: data.key,
                                amount: data.order.amount,
                                currency: data.order.currency,
                                name: "Student Loan",
                                description: `Repayment for loan ${activeLoan?.id}`,
                                order_id: data.order.id,
                                handler: async function (response: Record<string, string>) {
                                  try {
                                    // verify on backend
                                    const verifyResp = await fetch(`${API_BASE}/api/verify-payment`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        razorpay_order_id: response.razorpay_order_id,
                                        razorpay_payment_id: response.razorpay_payment_id,
                                        razorpay_signature: response.razorpay_signature,
                                        loanId: activeLoan?.id,
                                        studentId: user.email,
                                        amount: activeLoan?.amount
                                      })
                                    });

                                    if (!verifyResp.ok) {
                                      console.error("Verify payment failed:", verifyResp.status);
                                      throw new Error("Payment verification failed");
                                    }

                                    setPaidLoans((p) => [...p, activeLoan?.id || ""]);
                                    toast({ title: "Payment successful", description: "Thank you — payment recorded." });
                                  } catch (verifyErr: Error | unknown) {
                                    const errMsg = verifyErr instanceof Error ? verifyErr.message : "Could not verify payment with backend.";
                                    console.error("Payment verification error:", verifyErr);
                                    toast({ 
                                      title: "Payment Verification Failed", 
                                      description: errMsg, 
                                      variant: "destructive" 
                                    });
                                  }
                                },
                                prefill: { email: user.email }
                              };

                            
                              const rzp = new window.Razorpay(options);
                              rzp.open();
                            } catch (err: Error | unknown) {
                              const errMsg = err instanceof Error ? err.message : "Could not start payment.";
                              console.error(err);
                              toast({ title: "Payment failed", description: errMsg, variant: "destructive" });
                            } finally {
                              setProcessingPayment(false);
                            }
                          }}
                          disabled={processingPayment || (activeLoan && paidLoans.includes(activeLoan.id))}
                        >
                          {processingPayment ? "Processing..." : "Pay Now"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}



            {/* Approved & Disbursed Loans */}
            {loans.some(l => l.status === "approved" || l.status === "disbursed") && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="card-elevated border-green-200 bg-gradient-to-br from-green-50 to-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      Your Approved Loans
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {loans.filter(l => l.status === "approved" || l.status === "disbursed").map((loan) => (
                        <div
                          key={loan.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-green-100/50 border border-green-200"
                        >
                          <div className="flex items-center gap-4">
                            <Wallet className="h-8 w-8 text-green-600" />
                            <div>
                              <p className="font-semibold text-green-900">{loan.purpose}</p>
                              <p className="text-sm text-green-700">Amount: ₹{loan.amount.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">₹{loan.amount.toLocaleString()}</p>
                            <p className="text-xs text-green-600 font-semibold mt-1">
                              {loan.status === "disbursed" ? "✅ Disbursed" : "✅ Approved"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Transaction History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto">
                    {transactions && transactions.length > 0 ? (
                      <div className="space-y-3">
                        {transactions.slice(0, 5).map((tx: Transaction) => (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm capitalize">
                              {tx.transaction_type === 'approval' ? '✅ Loan Approved' : 
                               tx.transaction_type === 'disbursement' ? '💰 Money Disbursed' :
                               tx.transaction_type === 'rejection' ? '❌ Loan Rejected' :
                               tx.transaction_type === 'credit' ? '➕ Credit' :
                               '➖ Payment'}
                            </p>
                            <p className="text-xs text-muted-foreground">{tx.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(tx.created_at).toLocaleDateString('en-IN', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold text-sm ${
                              tx.transaction_type === 'approval' ? 'text-green-600' :
                              tx.transaction_type === 'disbursement' ? 'text-green-600' :
                              tx.transaction_type === 'rejection' ? 'text-red-600' :
                              tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ₹{tx.amount.toLocaleString('en-IN')}
                            </p>
                            <p className={`text-xs px-2 py-1 rounded mt-1 ${
                              tx.status === 'completed' ? 'text-green-600 bg-green-50' :
                              tx.status === 'pending' ? 'text-amber-600 bg-amber-50' :
                              'text-red-600 bg-red-50'
                            }`}>
                              {tx.status}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : loanRequests && loanRequests.length > 0 ? (
                    <div className="space-y-3">
                      {loanRequests.map((loan) => (
                        <div key={loan.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm capitalize">Loan Requested</p>
                            <p className="text-xs text-muted-foreground">Loan Requested - ₹{loan.amount} for {loan.reason}</p>
                            <p className="text-xs text-muted-foreground mt-1">{new Date(loan.applied_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm text-blue-600">₹{loan.amount.toLocaleString('en-IN')}</p>
                            <p className="text-xs px-2 py-1 rounded mt-1 text-amber-600 bg-amber-50">{loan.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No transactions yet</p>
                    </div>
                  )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
