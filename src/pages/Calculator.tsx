import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { EMICalculator } from "@/components/EMICalculator";

const Calculator = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            EMI Calculator
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Plan your loan repayments with our easy-to-use EMI calculator. Adjust the loan amount, interest rate, and tenure to see your monthly payments.
          </p>
        </motion.div>

        <EMICalculator />

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <div className="inline-block p-8 rounded-2xl bg-muted/50 border border-border">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Ready to apply?
            </h3>
            <p className="text-muted-foreground mb-4">
              Get your loan approved within 24-48 hours
            </p>
            <Button variant="hero" size="lg" asChild>
              <Link to="/register">
                Apply Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default Calculator;
