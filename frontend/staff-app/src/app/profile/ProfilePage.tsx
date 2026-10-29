import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import Skeleton from '@/components/Skeleton';

interface Props {
  onLogout: () => void;
}

const fmtMoney = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

const ProfilePage = ({ onLogout }: Props) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await attendanceService.getProfile(user.staffId);
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  if (loading) return <Skeleton type="profile" />;
  if (!user) return null;

  const p = profile || {};
  const name = p.name || user.name;
  const role = p.role || user.role;
  const phone = p.phone || user.phone || '-';
  const location = p.appLocation || user.appLocation || '-';
  const staffId = p.staffId || user.staffId;
  const baseSalary = p.baseSalary;
  const emergencyPhone = p.emergencyPhone;
  const allowedPerm = p.allowedPermHours;
  const accountNumber = p.accountNumber;
  const ifscCode = p.ifscCode;
  const pic = p.profilePicUrl;
  const showPic = pic && !imgFailed;

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {showPic ? (
          <img
            src={pic}
            alt=""
            className="avatar"
            style={{ objectFit: 'cover' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="avatar">{name?.charAt(0) || 'S'}</div>
        )}
        <h2 className="t-page-title" style={{ marginTop: 12 }}>{name}</h2>
        <p className="t-muted" style={{ fontSize: 14, marginTop: 2 }}>{role}</p>
      </div>

      {/* Account */}
      <div className="section-head">Account</div>
      <div className="group">
        <div className="row">
          <span className="row-label">Employee ID</span>
          <span className="row-value">{staffId}</span>
        </div>
        <div className="row">
          <span className="row-label">Role</span>
          <span className="row-value">{role}</span>
        </div>
        {baseSalary != null && (
          <div className="row">
            <span className="row-label">Base Salary</span>
            <span className="row-value">{fmtMoney(baseSalary)}</span>
          </div>
        )}
        {allowedPerm != null && allowedPerm !== 0 && (
          <div className="row">
            <span className="row-label">Permission Hrs</span>
            <span className="row-value">{allowedPerm}h / month</span>
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="section-head">Contact</div>
      <div className="group">
        <div className="row">
          <span className="row-label">Mobile Number</span>
          <span className="row-value">{phone}</span>
        </div>
        {emergencyPhone && (
          <div className="row">
            <span className="row-label">Emergency Contact</span>
            <span className="row-value">{emergencyPhone}</span>
          </div>
        )}
        <div className="row">
          <span className="row-label">Location</span>
          <span className="row-value">{location}</span>
        </div>
      </div>

      {/* Bank */}
      {accountNumber && (
        <div className="section-head">Bank Details</div>
      )}
      {accountNumber && (
        <div className="group">
          <div className="row">
            <span className="row-label">Account Number</span>
            <span className="row-value">{accountNumber}</span>
          </div>
          {ifscCode && (
            <div className="row">
              <span className="row-label">IFSC Code</span>
              <span className="row-value">{ifscCode}</span>
            </div>
          )}
        </div>
      )}

      {/* Logout */}
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-danger" onClick={onLogout}>
          <ion-icon name="log-out-outline" style={{ fontSize: 18 }} />
          Log Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
