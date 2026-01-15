import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Shield,
  Clock,
  Percent,
  FileCheck,
  Wallet,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeatureCard } from "@/components/FeatureCard";
import { EMICalculator } from "@/components/EMICalculator";

const features = [
  {
    icon: Percent,
    title: "Low Interest Rates",
    description: "Competitive rates starting from 5.5% p.a. designed specifically for students.",
  },
  {
    icon: Clock,
    title: "Quick Approval",
    description: "Get your loan approved within 24-48 hours with minimal documentation.",
  },
  {
    icon: FileCheck,
    title: "Simple Process",
    description: "Easy online application with step-by-step guidance throughout.",
  },
  {
    icon: Shield,
    title: "Secure & Safe",
    description: "Bank-grade security to protect your personal and financial information.",
  },
  {
    icon: Wallet,
    title: "Flexible Repayment",
    description: "Choose from multiple repayment options that fit your budget.",
  },
  {
    icon: GraduationCap,
    title: "Student Focused",
    description: "Built by students, for students. We understand your needs.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create Account",
    description: "Sign up with your email and verify your student status.",
  },
  {
    step: "02",
    title: "Apply for Loan",
    description: "Fill out the simple application form with your details.",
  },
  {
    step: "03",
    title: "Get Approved",
    description: "Our team reviews and approves eligible applications quickly.",
  },
  {
    step: "04",
    title: "Receive Funds",
    description: "Get your loan disbursed directly to your account.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-60 h-60 rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Trusted by 50,000+ students
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Fund Your
                <span className="text-gradient"> Education </span>
                Dreams Today
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg">
                Access affordable student loans with competitive rates, flexible repayment options, and a simple application process designed for your success.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/register">
                    Apply Now
                    <ArrowRight className="h-5 w-5 ml-1" />
                  </Link>
                </Button>
                <Button variant="outline" size="xl" asChild>
                  <Link to="/calculator">Calculate EMI</Link>
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">$50M+</p>
                  <p className="text-sm text-muted-foreground">Loans Disbursed</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div>
                  <p className="text-2xl font-bold text-foreground">5.5%</p>
                  <p className="text-sm text-muted-foreground">Starting Rate</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div>
                  <p className="text-2xl font-bold text-foreground">24hrs</p>
                  <p className="text-sm text-muted-foreground">Quick Approval</p>
                </div>
              </div>
            </motion.div>

            {/* Right Content - Hero Image/Illustration */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                {/* Main card */}
                <div className="rounded-3xl gradient-hero p-8 text-primary-foreground shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold">EduFund</p>
                        <p className="text-sm opacity-80">Student Loan</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-80">Approved Amount</p>
                      <p className="text-2xl font-bold">$25,000</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4">
                      <p className="text-sm opacity-80">Interest Rate</p>
                      <p className="text-xl font-bold">6.5% p.a.</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <p className="text-sm opacity-80">Monthly EMI</p>
                      <p className="text-xl font-bold">$478</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        <span>Verified Student</span>
                      </div>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating cards */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-6 -right-6 bg-card rounded-xl p-4 shadow-lg border border-border"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-semibold text-success">Approved!</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-4 -left-6 bg-card rounded-xl p-4 shadow-lg border border-border"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Security</p>
                      <p className="text-sm font-semibold">256-bit SSL</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose EduFund?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We're committed to making education financing simple, transparent, and accessible for every student.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={index * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get your student loan in four simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-bold text-primary/10 mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      EMI Calculator Section
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Calculate Your EMI
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Plan your repayments with our easy-to-use EMI calculator
            </p>
          </motion.div>

          <EMICalculator />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl gradient-hero p-8 md:p-16 text-center text-primary-foreground"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Your Education Journey?
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Join thousands of students who have already funded their dreams with EduFund. Apply now and get a decision within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="xl"
                className="bg-white text-primary hover:bg-white/90 shadow-lg"
                asChild
              >
                <Link to="/register">
                  Get Started Free
                  <ArrowRight className="h-5 w-5 ml-1" />
                </Link>
              </Button>
              <Button
                variant="glass"
                size="xl"
                className="border-white/30 text-white hover:bg-white/10"
                asChild
              >
                <Link to="/login">Already have an account?</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
