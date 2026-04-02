import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shoppingListService } from '../../services/shoppingListService';
import { consumptionProfileService } from '../../services/consumptionProfileService';
import type { GetActiveListResponse, ConsumptionProfile } from '../../types';
import Spinner from '../../components/Spinner';
import Layout from '../../components/Layout';
import banner from '../../assets/banner.png';

export default function DashboardPage() {
  const { user } = useAuth();
  const [listData, setListData] = useState<GetActiveListResponse | null>(null);
  const [profile, setProfile] = useState<ConsumptionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      shoppingListService.getActiveList(),
      consumptionProfileService.getProfile(),
    ])
      .then(([list, prof]) => {
        setListData(list);
        setProfile(prof);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const itemCount = listData?.activeList.items.length ?? 0;
  const baselineCount = profile?.baselineItems.length ?? 0;
  const suggestionCount = listData?.soonSuggestions.length ?? 0;

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Banner ── */}
        <img
          src={banner}
          alt="SmartList banner"
          style={{
            display: 'block',
            margin: '20px auto',
            maxWidth: '1050px',
            width: '100%',
            height: 'auto',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        />

        {/* ── Greeting ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hello, {user?.fullName?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Here&apos;s your shopping overview.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                label="To buy"
                value={itemCount}
                to="/shopping-list"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Baseline"
                value={baselineCount}
                to="/consumption-profile"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <StatCard
                label="Coming soon"
                value={suggestionCount}
                to="/shopping-list"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </div>

            {/* ── Onboarding prompt (no baseline yet) ── */}
            {!loading && baselineCount === 0 && (
              <OnboardingPrompt />
            )}

            {/* ── Coming up soon ── */}
            {listData && listData.soonSuggestions.length > 0 && (
              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-brand-800">Running low soon</h2>
                </div>
                <div className="space-y-2">
                  {listData.soonSuggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-brand-100"
                    >
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                      <span className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-0.5 rounded-full">
                        {s.daysUntilDue === 1 ? 'Tomorrow' : `In ${s.daysUntilDue} days`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Quick actions ── */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Quick actions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <QuickAction
                  to="/shopping-list"
                  title="Shopping list"
                  description={
                    itemCount === 0
                      ? 'Your list is empty'
                      : `${itemCount} item${itemCount !== 1 ? 's' : ''} to buy`
                  }
                  icon={
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  }
                />
                <QuickAction
                  to="/receipts"
                  title="Upload receipt"
                  description="Scan & auto-match items"
                  icon={
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  }
                />
                <QuickAction
                  to="/consumption-profile"
                  title="My baseline"
                  description={`${baselineCount} regular item${baselineCount !== 1 ? 's' : ''} tracked`}
                  icon={
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

// ── OnboardingPrompt ─────────────────────────────────────────────────────────

function OnboardingPrompt() {
  return (
    <div className="bg-white border border-brand-100 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
      <div className="flex-shrink-0 w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center">
        <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">
          Start building your smart shopping profile
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Add the products you usually buy so SmartList can help you restock on time.
        </p>
      </div>
      <Link
        to="/consumption-profile"
        className="flex-shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
      >
        Add your first item
      </Link>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 hover:border-brand-200 hover:shadow-sm transition-all group"
    >
      <div className="inline-flex p-2 rounded-xl bg-brand-50 text-brand-600 mb-3 group-hover:bg-brand-100 transition-colors">
        {icon}
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs sm:text-sm text-gray-400 mt-0.5">{label}</div>
    </Link>
  );
}

// ── QuickAction ───────────────────────────────────────────────────────────────

function QuickAction({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-3.5 hover:border-brand-200 hover:shadow-sm transition-all group"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center group-hover:bg-brand-100 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-gray-400 text-xs mt-0.5 truncate">{description}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
