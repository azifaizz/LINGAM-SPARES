import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import { getCurrentYearMonth } from '@/utils/date';

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const PayrollPage = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [slip, setSlip] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await attendanceService.getMySalary(user.staffId, selectedMonth);
        setSlip(data);
      } catch {
        setSlip(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, selectedMonth]);

  const monthLabel = slip?.month
    ? new Date(`${slip.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div>
      {/* Month picker */}
      <div className="field" style={{ marginTop: 4 }}>
        <input
          className="field-input"
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner dark" style={{ width: 28, height: 28 }} />
        </div>
      ) : slip ? (
        <>
          {/* Net Salary hero (not huge) */}
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div className="t-label" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Salary</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', marginTop: 6, letterSpacing: '-0.02em' }}>
              {fmt(slip.netSalary)}
            </div>
            <div className="t-tiny" style={{ marginTop: 4 }}>{monthLabel}</div>
          </div>

          {/* Breakdown */}
          <div className="group" style={{ marginTop: 16 }}>
            <div className="row">
              <span className="row-label">Base Salary</span>
              <span className="row-value">{fmt(slip.baseSalary)}</span>
            </div>
            <div className="row">
              <span className="row-label">LOP (Loss of Pay)</span>
              <span className="row-value" style={{ color: 'var(--danger)' }}>{fmt(slip.lopAmount)}</span>
            </div>
            {slip.permissionDeduction > 0 && (
              <div className="row">
                <span className="row-label">Permission</span>
                <span className="row-value" style={{ color: 'var(--danger)' }}>{fmt(slip.permissionDeduction)}</span>
              </div>
            )}
          </div>

          {/* Take Home */}
          <div className="group" style={{ marginTop: 16 }}>
            <div className="row" style={{ padding: '16px' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Take Home</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmt(slip.netSalary)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="card t-muted" style={{ textAlign: 'center', fontSize: 14, marginTop: 16 }}>
          No salary record for this month
        </div>
      )}
    </div>
  );
};

export default PayrollPage;
