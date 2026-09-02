import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import RequireAuth from "@/components/admin/RequireAuth";
import Analytics from "@/pages/Analytics";
import Bookings from "@/pages/Bookings";
import CustomerDetail from "@/pages/CustomerDetail";
import Customers from "@/pages/Customers";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Notifications from "@/pages/Notifications";
import Offers from "@/pages/Offers";
import PartnerDetail from "@/pages/PartnerDetail";
import PartnerVerification from "@/pages/PartnerVerification";
import Partners from "@/pages/Partners";
import Payments from "@/pages/Payments";
import Reviews from "@/pages/Reviews";
import Services from "@/pages/Services";
import Settings from "@/pages/Settings";
import Support from "@/pages/Support";
import VerificationWorkspace from "@/pages/VerificationWorkspace";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/partners/:id" element={<PartnerDetail />} />
            <Route path="/partner-verification" element={<PartnerVerification />} />
            <Route path="/partner-verification/:id" element={<VerificationWorkspace />} />
            <Route path="/services" element={<Services />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/support" element={<Support />} />
            <Route path="/offers" element={<Offers />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
