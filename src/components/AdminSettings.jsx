import { ArrowRight, MapPin, Users } from 'lucide-react';
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

  const cards = [
    { view: 'users', icon: <Users size={28} />, title: 'ผู้ใช้และสิทธิ์', desc: 'ดูบัญชีผู้ใช้ทั้งหมด กำหนดสิทธิ์ สังกัด และเปลี่ยนรหัสผ่าน', action: perms.canEditUsers ? 'จัดการผู้ใช้' : 'ดูรายชื่อผู้ใช้' },
    { view: 'locations', icon: <MapPin size={28} />, title: 'สำนักงาน', desc: 'รายชื่อสำนักงาน จังหวัด พิกัดบนแผนที่ และอุปกรณ์เครือข่ายที่ผูกอยู่', action: perms.canManageLocations ? 'จัดการสำนักงาน' : 'ดูรายชื่อสำนักงาน' }
  ];

  return (
    <div className="list-page as-page">
      <header className="list-header">
        <div>
          <h1>การตั้งค่าระบบ</h1>
          <p>จัดการผู้ใช้ สิทธิ์การเข้าถึง และข้อมูลสำนักงาน{perms.readOnly ? ' · บัญชีนี้ดูข้อมูลได้อย่างเดียว' : ''}</p>
        </div>
      </header>
      <ul className="as-cards">
        {cards.map(({ view: v, icon, title, desc, action }) => (
          <li key={v}>
            <a
              className="as-card"
              href={`/settings/${v}`}
              onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); go(v); } }}
            >
              <span className="as-card-icon" aria-hidden="true">{icon}</span>
              <span className="as-card-title">{title}</span>
              <span className="as-card-desc">{desc}</span>
              <span className="as-card-action">{action} <ArrowRight size={16} aria-hidden="true" /></span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminSettings;
