import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StatCard } from "@/components/StatCard";
import { LoanStatusBadge } from "@/components/LoanStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LoanApplication {
  id: string;
  student_name: string;
  student_email: string;
  college: string;
  amount: number;
  purpose: string;
  status: "pending" | "applied" | "approved" | "rejected" | "disbursed";
  created_at: string;
  tenure_months: number;
}

const mockApplications: LoanApplication[] = [
  {
    id: "1",
    student_name: "John Doe",
    student_email: "john@mit.edu",
    college: "MIT",
    amount: 25000,
    purpose: "Tuition Fees",
    status: "pending",
    created_at: new Date().toISOString(),
    tenure_months: 48,
  },
  {
    id: "2",
    student_name: "Jane Smith",
    student_email: "jane@stanford.edu",
    college: "Stanford",
    amount: 35000,
    purpose: "Study Abroad",
    status: "approved",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    tenure_months: 60,
  },
  {
    id: "3",
    student_name: "Mike Johnson",
    student_email: "mike@harvard.edu",
    college: "Harvard",
    amount: 15000,
    purpose: "Books & Supplies",
    status: "disbursed",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    tenure_months: 24,
  },
];

const AdminDashboard = () => {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [applications, setApplications] = useState<LoanApplication[]>(mockApplications);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      setUser({ email: session.user.email || "" });
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleApprove = async (id: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, status: "approved" as const } : app
      )
    );
    toast({
      title: "Application Approved",
      description: "The loan application has been approved successfully.",
    });
  };

  const handleReject = async (id: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, status: "rejected" as const } : app
      )
    );
    toast({
      title: "Application Rejected",
      description: "The loan application has been rejected.",
      variant: "destructive",
    });
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.student_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.college.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalApplications: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    totalDisbursed: applications
      .filter((a) => a.status === "disbursed")
      .reduce((sum, a) => sum + a.amount, 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} isAdmin />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage loan applications and student records
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={FileText}
            label="Total Applications"
            value={stats.totalApplications}
            delay={0}
          />
          <StatCard
            icon={Clock}
            label="Pending Review"
            value={stats.pending}
            delay={0.1}
          />
          <StatCard
            icon={CheckCircle}
            label="Approved"
            value={stats.approved}
            delay={0.2}
          />
          <StatCard
            icon={DollarSign}
            label="Total Disbursed"
            value={formatCurrency(stats.totalDisbursed)}
            delay={0.3}
          />
        </div>

        {/* Applications Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle>Loan Applications</CardTitle>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="disbursed">Disbursed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Student
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        College
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Purpose
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => (
                      <tr
                        key={app.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {app.student_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {app.student_email}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm">{app.college}</td>
                        <td className="py-4 px-4 font-medium">
                          {formatCurrency(app.amount)}
                        </td>
                        <td className="py-4 px-4 text-sm">{app.purpose}</td>
                        <td className="py-4 px-4">
                          <LoanStatusBadge status={app.status} />
                        </td>
                        <td className="py-4 px-4">
                          {app.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleApprove(app.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleReject(app.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {app.status === "approved" && (
                            <Button variant="outline" size="sm">
                              Disburse
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredApplications.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No applications found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
