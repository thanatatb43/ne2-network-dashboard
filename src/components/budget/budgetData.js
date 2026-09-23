export const filterKeys = ['fiscal_year','account_code','clearing_account_name','username','reference_doc_no','description','posting_month','amount_direction'];
export const columns = [['document_date','วันที่เอกสาร'],['posting_date','วันที่ลงบัญชี'],['reference_doc_no','เลขที่เอกสาร'],['description','รายละเอียด'],['account_code','รหัสบัญชี'],['account_name','ชื่อบัญชี'],['username','ผู้ใช้'],['fiscal_year','ปีข้อมูล'],['clearing_account_code','รหัสบัญชีหักล้าง'],['clearing_account_name','บัญชีหักล้าง'],['amount','จำนวนเงิน (บาท)']];
export const sorts = ['posting_date','document_date','reference_doc_no','description','account_code','clearing_account_name','username','amount'];
export function readQuery() {
  const p = new URLSearchParams(location.search);
  const result = Object.fromEntries(filterKeys.map(k => [k,p.get(k)||'']));
  if(result.fiscal_year && !/^\d{4}$/.test(result.fiscal_year)) result.fiscal_year='';
  if(result.posting_month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(result.posting_month)) result.posting_month='';
  if(!['','debit','credit','all'].includes(result.amount_direction)) result.amount_direction='';
  return {...result,q:p.get('q')||'',page:Math.max(1,Math.floor(Number(p.get('page'))||1)),page_size:[10,15,25,50,100].includes(Number(p.get('page_size')))?Number(p.get('page_size')):15,sort:sorts.includes(p.get('sort'))?p.get('sort'):'posting_date',order:p.get('order')==='asc'?'asc':'desc',transaction_id:/^\d+$/.test(p.get('transaction_id')||'')?p.get('transaction_id'):''};
}
export function params(values,keys=Object.keys(values)) { return new URLSearchParams(keys.filter(k=>values[k]!=='' && values[k]!=null).map(k=>[k,String(values[k])])).toString(); }
export async function request(path,signal) {
  const response=await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/budgets/${path}`,{signal});
  const body=await response.json();
  if(!response.ok || !body.success) throw new Error(response.status===404?'ไม่พบรายการนี้':'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
  return body;
}
export function cents(value) {
  if(!/^-?\d+(\.\d{1,2})?$/.test(String(value??''))) return null;
  const [a,b='']=String(value).replace('-','').split('.');
  return (BigInt(a)*100n+BigInt(b.padEnd(2,'0')))*(String(value).startsWith('-')?-1n:1n);
}
export function decimal(n) { const a=n<0n?-n:n; return `${n<0n?'-':''}${a/100n}.${String(a%100n).padStart(2,'0')}`; }
export function money(value) { const n=cents(value);if(n===null)return '—';const a=n<0n?-n:n;return `${n<0n?'-':''}฿${(a/100n).toLocaleString('th-TH')}.${String(a%100n).padStart(2,'0')}`; }
export function monthLabel(v) { return /^\d{4}-\d{2}$/.test(v||'')?new Date(`${v}-01T12:00:00`).toLocaleDateString('th-TH',{month:'short',year:'numeric'}):'ไม่ระบุเดือน'; }
export function aggregateRows(rows,year) {
  const empty=()=>({debit:0n,credit:0n,net:0n,transaction_count:0});const buckets=new Map();const total=empty();let missing=0;
  if(year)for(let i=1;i<=12;i++)buckets.set(`${year}-${String(i).padStart(2,'0')}`,empty());
  for(const row of rows){const value=cents(row.amount);if(value===null)throw new Error('ข้อมูลจำนวนเงินไม่ถูกต้อง');const targets=[total];
    if(row.posting_month){if(!buckets.has(row.posting_month))buckets.set(row.posting_month,empty());targets.push(buckets.get(row.posting_month));}else missing++;
    for(const target of targets){target[value<0n?'credit':'debit']+=value;target.net+=value;target.transaction_count++;}}
  const format=b=>({debit:decimal(b.debit),credit:decimal(b.credit),net:decimal(b.net),transaction_count:b.transaction_count});
  return {totals:format(total),by_month:[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([month,b])=>({month,...format(b)})),coverage:{records_without_posting_date:missing}};
}
