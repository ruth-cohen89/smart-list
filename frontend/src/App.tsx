import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ShoppingListPage from './features/shopping-list/ShoppingListPage';
import ConsumptionProfilePage from './features/consumption-profile/ConsumptionProfilePage';
import ReceiptsPage from './features/receipts/ReceiptsPage';
import ReceiptDetailPage from './features/receipts/ReceiptDetailPage';
import PriceComparisonPage from './features/price-comparison/PriceComparisonPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
            <Route path="/consumption-profile" element={<ConsumptionProfilePage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/receipts/:receiptId" element={<ReceiptDetailPage />} />
            <Route path="/price-comparison" element={<PriceComparisonPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
