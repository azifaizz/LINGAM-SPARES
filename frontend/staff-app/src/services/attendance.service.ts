import api from './api.service';

interface TodayStatus {
  marked: boolean;
  status?: string;
  inTime?: string;
  outTime?: string;
  remarks?: string;
}

interface MarkResult {
  alreadyMarked?: boolean;
  success?: boolean;
  status?: string;
  inTime?: string;
  distance?: number;
  message?: string;
  allowedRadius?: number;
}

export const attendanceService = {
  async checkToday(staffId: string, date: string): Promise<TodayStatus> {
    const res = await api.get(`/attendance/check-today/${staffId}/${date}`);
    return res.data;
  },

  async selfMark(staffId: string, date: string, latitude: number, longitude: number): Promise<MarkResult> {
    const res = await api.post('/attendance/self-mark', {
      staffId,
      date,
      latitude,
      longitude,
    });
    return res.data;
  },

  async getMyAttendance(staffId: string, yearMonth: string): Promise<Record<string, any>> {
    const res = await api.get(`/${staffId}/my-attendance/${yearMonth}`);
    return res.data;
  },

  async getMySalary(staffId: string, yearMonth: string): Promise<any> {
    const res = await api.get(`/${staffId}/my-salary/${yearMonth}`);
    return res.data;
  },

  async getProfile(staffId: string): Promise<any> {
    const res = await api.get(`/${staffId}/profile`);
    return res.data;
  },
};
