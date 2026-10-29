import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://staff-service-949402843265.asia-southeast1.run.app';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/staff`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('staff_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
