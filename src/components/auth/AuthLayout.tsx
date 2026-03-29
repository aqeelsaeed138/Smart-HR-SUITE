import { ReactNode } from "react";
import { Shield, Users, Clock, BarChart3 } from "lucide-react";

const features = [
  { icon: Users, label: "Employee Directory" },
  { icon: Clock, label: "Attendance Tracking" },
  { icon: BarChart3, label: "Payroll & Analytics" },
  { icon: Shield, label: "Role-Based Access" },
];

export const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] gradient-hero flex-col justify-between p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-80 h-80 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-64 h-64 rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">EMS</span>
          </div>
          <p className="text-sm opacity-70 ml-[52px]">Employee Management System</p>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Manage your workforce
            <br />
            <span className="text-accent">smarter.</span>
          </h1>
          <p className="text-base opacity-80 max-w-md leading-relaxed">
            Streamline HR operations with automated attendance, payroll, and analytics — all in one secure platform.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-primary-foreground/10 px-4 py-3 backdrop-blur-sm">
                <Icon className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs opacity-50">
          © {new Date().getFullYear()} Smart Employee Management System
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </div>
    </div>
  );
};
