import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const LoanApplication = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", college: "", amount: "", reason: "", account_number: "", account_holder_name: "", bank_name: "", ifsc_code: "" });
  const navigate = useNavigate();
  const { toast } = useToast();
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUser({ email: session.user.email || "" });
      setForm((f) => ({ ...f, email: session.user.email || "" }));
    };
    checkAuth();
  }, [navigate]);

  const handleChange = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const submit = async () => {
    setIsLoading(true);
    try {
      // validation
      if (!form.full_name || !form.email || !form.phone || !form.college || !form.amount || !form.reason) {
        toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // bank/account validation
      if (!form.account_number || !form.account_holder_name || !form.ifsc_code) {
        toast({ title: "Missing bank details", description: "Please provide account number, account holder name and IFSC.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const amountNum = Number(form.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        toast({ title: "Invalid amount", description: "Please enter a valid amount.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (amountNum > 1500) {
        toast({ title: "Amount exceeds limit", description: "Maximum loan amount is ₹1500.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const resp = await fetch(`${API_BASE}/api/apply-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          college: form.college,
          amount: amountNum,
          reason: form.reason,
          account_number: form.account_number,
          account_holder_name: form.account_holder_name,
          bank_name: form.bank_name,
          ifsc_code: form.ifsc_code,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Application failed");

      toast({ title: "Application submitted", description: "Your application has been sent for review." });
      navigate("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Submission failed", description: message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" className="mb-6" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Student Loan Application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
            </div>
            <div>
              <Label>Phone (required)</Label>
              <Input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </div>
            <div>
              <Label>College name</Label>
              <Input value={form.college} onChange={(e) => handleChange("college", e.target.value)} />
            </div>
            <div>
              <Label>Loan amount (max ₹1500)</Label>
              <Input value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} />
            </div>
            <div>
              <Label>Reason for loan</Label>
              <Textarea value={form.reason} onChange={(e) => handleChange("reason", e.target.value)} rows={4} />
            </div>

            <div>
              <Label>Account holder name (required)</Label>
              <Input value={form.account_holder_name} onChange={(e) => handleChange("account_holder_name", e.target.value)} />
            </div>

            <div>
              <Label>Account number (required)</Label>
              <Input value={form.account_number} onChange={(e) => handleChange("account_number", e.target.value)} />
            </div>

            <div>
              <Label>IFSC code (required)</Label>
              <Input value={form.ifsc_code} onChange={(e) => handleChange("ifsc_code", e.target.value)} />
            </div>

            <div>
              <Label>Bank name (optional)</Label>
              <Input value={form.bank_name} onChange={(e) => handleChange("bank_name", e.target.value)} />
            </div>

            <div className="text-sm text-muted-foreground">
              Loans are for a fixed duration of 2 days only. Repayment deadline will be set when the admin approves the loan.
            </div>

            <div className="flex justify-end">
              <Button variant="success" onClick={submit} disabled={isLoading}>{isLoading ? "Submitting..." : "Submit Application"}</Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default LoanApplication;
