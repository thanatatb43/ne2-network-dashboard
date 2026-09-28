import { MapPin, Users } from 'lucide-react';
import NavCards from './common/NavCards.jsx';
import SettingsUsers from './settings/SettingsUsers';
import SettingsUserEdit from './settings/SettingsUserEdit';
import SettingsLocations from './settings/SettingsLocations';
import { settingsPermissions } from './settings/settingsShared';
import './ListPage.css';
import './AdminSettings.css';

// /settings, /settings/users, /settings/users/:id and /settings/locations --
// the URL (owned by App) picks the page, so browser Back moves between them.
const AdminSettings = ({ token, user, view = 'overview', itemId = null, onViewChange }) => {
  const go = (next, id = null) => onViewChange?.(next, id);
  const perms = settingsPermissions(user);

  if (view === 'users' && itemId) {
    return <SettingsUserEdit key={itemId} token={token} currentUser={user} userId={itemId} onDone={() => go('users')} />;
  }
  if (view === 'users') return <SettingsUsers token={token} currentUser={user} onBack={() => go('overview')} onEdit={(id) => go('users', id)} />;
  if (view === 'locations') return <SettingsLocations token={token} currentUser={user} onBack={() => go('overview')} />;

  return (
    <div className="list-page as-page">
      <header className="list-header">
        <div>
          <h1>การตั้งค่าระบบ</h1>
          <p>จัดการผู้ใช้ สิทธิ์การเข้าถึง และข้อมูลสำนักงาน{perms.readOnly ? ' · บัญชีนี้ดูข้อมูลได้อย่างเดียว' : ''}</p>
        </div>
      </header>
      <NavCards label="ส่วนการตั้งค่า" items={[
        { key: 'users', href: '/settings/users', icon: <Users size={28} />, title: 'ผู้ใช้และสิทธิ์', desc: 'ดูบัญชีผู้ใช้ทั้งหมด กำหนดสิทธิ์ สังกัด และเปลี่ยนรหัสผ่าน', action: perms.canEditUsers ? 'จัดการผู้ใช้' : 'ดูรายชื่อผู้ใช้', onNavigate: () => go('users') },
        { key: 'locations', href: '/settings/locations', tone: 'amber', icon: <MapPin size={28} />, title: 'สำนักงาน', desc: 'รายชื่อสำนักงาน จังหวัด พิกัดบนแผนที่ และอุปกรณ์เครือข่ายที่ผูกอยู่', action: perms.canManageLocations ? 'จัดการสำนักงาน' : 'ดูรายชื่อสำนักงาน', onNavigate: () => go('locations') }
      ]} />
    </div>
  );
};

export default AdminSettings;
