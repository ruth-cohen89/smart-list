import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import logo from '../../assets/logo.png';

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { message?: string } } }).response;
    if (res?.data?.message) return res.data.message;
  }
  return 'Something went wrong. Please try again.';
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.forgotPassword({ email });
      setResetToken(data.resetToken);
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="SmartList"
            className="w-16 h-16 object-contain mx-auto mb-3 drop-shadow-sm"
          />
          <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
          <p className="text-gray-500 mt-1 text-sm">Enter your email to receive a reset token</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {resetToken ? (
            <div className="space-y-4">
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                <p className="text-sm font-medium text-brand-800 mb-2">Your reset token:</p>
                <code className="text-xs break-all text-brand-700 block font-mono bg-white border border-brand-100 rounded-lg p-3">
                  {resetToken}
                </code>
              </div>
              <p className="text-xs text-gray-500">
                Copy this token and use it on the reset password page. It expires in 15 minutes.
              </p>
              <Link
                to="/reset-password"
                className="block w-full text-center bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                Go to reset password
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Sending…' : 'Get reset token'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
