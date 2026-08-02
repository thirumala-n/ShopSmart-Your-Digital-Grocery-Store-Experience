import { useEffect, useState } from 'react';
import ErrorState from '../components/ErrorState';
import Loader from '../components/Loader';
import { accountApi } from '../services/api';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await accountApi.getProfile();
      const user = data?.data || {};
      setProfile(user);
      setForm({ name: user.name || '', phone: user.phone || '' });
    };

    load();
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await accountApi.updateProfile(form);
      setProfile(data?.data || profile);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!profile) return <Loader message="Loading profile..." />;

  return (
    <div className="page">
      <h2>Profile</h2>
      <form className="form-card" onSubmit={save}>
        {error && <ErrorState message={error} />}
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button type="submit">Save</button>
      </form>
    </div>
  );
};

export default Profile;
