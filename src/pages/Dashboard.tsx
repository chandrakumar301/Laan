import { useState, useEffect } from "react";
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

const Dashboard = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
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
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/login");
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
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
            label="Active Applications"
            value={loans.length}
            delay={0.3}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
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

                            if (paidLoans.includes(activeLoan?.id || "")) return;

                            setProcessingPayment(true);

                            try {
                              // create order on backend
                              const resp = await fetch(`${API_BASE}/api/create-order`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ loanId: activeLoan?.id, studentId: user.email, amount: activeLoan?.amount })
                              });
                              const data = await resp.json();
                              if (!resp.ok) throw new Error(data.error || "Failed to create order");

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
                                handler: async function (response: any) {
                                  // verify on backend
                                  await fetch(`${API_BASE}/api/verify-payment`, {
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

                                  setPaidLoans((p) => [...p, activeLoan?.id || ""]);
                                  toast({ title: "Payment successful", description: "Thank you — payment recorded." });
                                },
                                prefill: { email: user.email }
                              };

                              // @ts-ignore
                              const rzp = new window.Razorpay(options);
                              rzp.open();
                            } catch (err: any) {
                              console.error(err);
                              toast({ title: "Payment failed", description: err.message || "Could not start payment.", variant: "destructive" });
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

            {/* Loan Applications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="card-elevated">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Loan Applications</CardTitle>
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/apply">
                      <Plus className="h-4 w-4 mr-1" />
                      New Application
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {loans.length > 0 ? (
                    <div className="space-y-4">
                      {loans.map((loan) => (
                        <div
                          key={loan.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {loan.purpose}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Applied on {new Date(loan.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold text-foreground">
                                {formatCurrency(loan.amount)}
                              </p>
                              <LoanStatusBadge status={loan.status} />
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        No loan applications yet
                      </p>
                      <Button variant="hero" asChild>
                        <Link to="/apply">Apply for your first loan</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/apply">
                      <Plus className="h-4 w-4 mr-2" />
                      Apply for New Loan
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/calculator">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Calculate EMI
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming Payments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg">Upcoming Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeLoan ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Feb 15, 2024</p>
                            <p className="text-xs text-muted-foreground">Monthly EMI</p>
                          </div>
                        </div>
                        <p className="font-semibold">$552</p>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Mar 15, 2024</p>
                            <p className="text-xs text-muted-foreground">Monthly EMI</p>
                          </div>
                        </div>
                        <p className="font-semibold text-muted-foreground">$552</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No upcoming payments
                    </p>
                  )}
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
