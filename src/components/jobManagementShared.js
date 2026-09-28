// Shared by the job list (JobManagement) and a job's page
// (JobManagementDetails).

const WORKFLOW_ROLES = ['super_admin', 'network_admin', 'computer_admin', 'operator'];

// Same role rules the page always had (the backend enforces its own):
// workflow roles start/close/cancel jobs and see history, and may edit only
// while a job is still เปิดงาน; super_admin may edit at any status and delete.
export const jobPermissions = (user) => {
  const canManageWorkflow = WORKFLOW_ROLES.includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
  return {
    canManageWorkflow,
    canViewHistory: canManageWorkflow,
    canDelete: isSuperAdmin,
    isSuperAdmin,
    canEdit: (job) => (canManageWorkflow && job?.status === 'เปิดงาน') || isSuperAdmin
  };
};

export const deleteJob = async (id, token) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pea-jobs/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.success !== false) return { ok: true, message: result.message || 'ลบงานแล้ว' };
    if (response.status === 401) return { ok: false, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
    if (response.status === 403) return { ok: false, message: 'บัญชีนี้ไม่มีสิทธิ์ลบงาน' };
    return { ok: false, message: result.message || result.error || 'ลบงานไม่สำเร็จ' };
  } catch {
    return { ok: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ งานยังไม่ถูกลบ' };
  }
};

// One-shot hint from a list row's action (e.g. the pencil) to the job page,
// which opens the matching dialog once the job has loaded.
const INTENT_KEY = 'job_mgmt_intent';
export const setJobIntent = (id, action) => {
  try { sessionStorage.setItem(INTENT_KEY, JSON.stringify({ id: String(id), action })); } catch { /* optional */ }
};
export const takeJobIntent = (id) => {
  try {
    const intent = JSON.parse(sessionStorage.getItem(INTENT_KEY));
    sessionStorage.removeItem(INTENT_KEY);
    return intent?.id === String(id) ? intent.action : null;
  } catch {
    return null;
  }
};
