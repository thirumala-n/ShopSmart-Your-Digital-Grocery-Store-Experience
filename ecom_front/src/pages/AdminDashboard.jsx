import { useEffect, useState } from 'react';
import { adminApi } from '../services/api';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [metricsRes, usersRes] = await Promise.all([
        adminApi.dashboardMetrics(),
        adminApi.listUsers({ page: 1, pageSize: 10 }),
      ]);
      setMetrics(metricsRes?.data?.data || null);
      setUsers(usersRes?.data?.items || []);
    };

    load();
  }, []);

  return (
    <div className="page">
      <h2>Admin dashboard</h2>
      <pre>{JSON.stringify(metrics, null, 2)}</pre>
      <h3>Users</h3>
      {users.map((user) => <div key={user.id} className="card">{user.name || user.email}</div>)}
    </div>
  );
};

export default AdminDashboard;
