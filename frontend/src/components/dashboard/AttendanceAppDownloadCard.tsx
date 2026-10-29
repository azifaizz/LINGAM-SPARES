import { useState, useEffect } from 'react';
import { Smartphone, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { appReleaseService, AppReleaseInfo, DEFAULT_RELEASE } from '@/services/appRelease.service';
import { toast } from 'react-hot-toast';

interface AttendanceAppDownloadCardProps {
  className?: string;
}

export const AttendanceAppDownloadCard = ({ className = '' }: AttendanceAppDownloadCardProps) => {
  const [release, setRelease] = useState<AppReleaseInfo>(DEFAULT_RELEASE);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const loadRelease = async () => {
      try {
        setLoading(true);
        const info = await appReleaseService.getLatestRelease();
        if (mounted) {
          setRelease(info);
          if (!info.downloadUrl) {
            setErrorMsg('Attendance app is currently unavailable. Please try again later.');
          } else {
            setErrorMsg('');
          }
        }
      } catch (e) {
        if (mounted) {
          console.warn('Could not load attendance release info', e);
          setErrorMsg('Attendance app is currently unavailable. Please try again later.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadRelease();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownload = async () => {
    if (!release.downloadUrl) {
      toast.error('Attendance app is currently unavailable. Please try again later.');
      return;
    }

    try {
      setDownloading(true);
      // Trigger native browser download via anchor
      const a = document.createElement('a');
      a.href = release.downloadUrl;
      a.download = release.fileName || 'Lingam_Spares_Attendance.apk';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('Starting APK download...');
    } catch (err) {
      console.error('Download failed', err);
      toast.error('Attendance app is currently unavailable. Please try again later.');
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
          <Smartphone size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Attendance Mobile App</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Allow employees to install the mobile application for attendance, leave and payroll access.
          </p>
        </div>
      </div>

      {/* Release Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Version</span>
          <div className="text-base font-bold text-gray-800 mt-0.5 flex items-center gap-1.5">
            <span>{release.version || '1.0.0'}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
              Latest
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Last Updated</span>
          <div className="text-base font-semibold text-gray-700 mt-0.5">
            {release.lastUpdated || '22 October 2026'}
          </div>
        </div>
      </div>

      {/* Error / Alert banner if unavailable */}
      {errorMsg && !loading && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800 max-w-lg">
          <AlertCircle size={16} className="flex-shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Download Action */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading || downloading || !release.downloadUrl}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center gap-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Checking release...</span>
            </>
          ) : downloading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Downloading APK...</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>Download Attendance App</span>
            </>
          )}
        </button>

        {release.fileSizeBytes && (
          <span className="text-xs text-gray-400">
            (~{(release.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB)
          </span>
        )}
      </div>
    </div>
  );
};

export default AttendanceAppDownloadCard;
