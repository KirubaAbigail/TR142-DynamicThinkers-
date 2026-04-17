import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

export const getJobs = async (query, location) => {
  const response = await api.post('/jobs', { query, location });
  return response.data;
};

export const analyzeJob = async (job) => {
  const response = await api.post(`/analyze/${job.id}`, job);
  return response.data;
};

export const getTrendDashboard = async () => {
  const response = await api.get('/stats/trend');
  return response.data;
};

export default api;
