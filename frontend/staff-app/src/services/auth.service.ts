import api from './api.service';

interface LoginResponse {
  staffId: string;
  name: string;
  phone: string;
  role: string;
  appLocation: string;
  token: string;
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
  },

  logout(): void {
    localStorage.removeItem('staff_auth_token');
    localStorage.removeItem('staff_profile');
  },

  saveSession(data: LoginResponse): void {
    localStorage.setItem('staff_auth_token', data.token);
    localStorage.setItem('staff_profile', JSON.stringify({
      staffId: data.staffId,
      name: data.name,
      phone: data.phone,
      role: data.role,
      appLocation: data.appLocation,
    }));
  },

  getProfile(): { staffId: string; name: string; phone: string; role: string; appLocation: string } | null {
    const profile = localStorage.getItem('staff_profile');
    return profile ? JSON.parse(profile) : null;
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem('staff_auth_token');
  },
};
