import {useEffect,useRef,useState} from 'react';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ComposedChart,Line} from 'recharts';
import {ArrowLeft,RefreshCw,Search,X} from 'lucide-react';
import SearchableDropdown from '../SearchableDropdown';
import useBudgetResource,{loadResults} from './useBudgetResource';
import {readQuery,params,filterKeys,request,money,monthLabel,columns,sorts} from './budgetData';
import '../ListPage.css';
import './BudgetDashboard.css';

const labels={fiscal_year:'ปีข้อมูล',account_code:'รหัสบัญชี',clearing_account_name:'บัญชีหักล้าง',username:'ผู้ใช้',reference_doc_no:'เลขที่เอกสาร',description:'รายละเอียด',posting_month:'เดือน',amount_direction:'ประเภทรายการ',q:'ค้นหาในผลลัพธ์'};
const selectorFields={account_code:'account',clearing_account_name:'clearing_account',username:'username',reference_doc_no:'reference_doc',description:'description'};
const fields=Object.keys(selectorFields);
const fieldClass=value=>`list-field${String(value??'').trim()&&value!=='all'?' budget-field-filled':''}`;
const colors={debit:'var(--budget-debit)',credit:'var(--budget-credit)',net:'var(--budget-net)',allocated:'var(--budget-allocated)',spent:'var(--budget-spent)'};
const payload=value=>value?.payload||value;
const chartNumbers=rows=>rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,['allocated','spent','debit','credit','net'].includes(k)?(v==null?null:Number(v)):v])));
function State({resource,retry}){
  if(resource.loading)return <p className="budget-state" role="status">{resource.progress||'กำลังโหลดข้อมูล…'}</p>;
  if(resource.error)return <div className="list-error" role="alert">{resource.error}<button className="list-button" onClick={retry}>ลองใหม่</button></div>;
  return null;
}
function Amounts({values,onClick}){return <div className="budget-stats">{values.map(([label,value,note,tone])=>{
  const Tag=onClick?'button':'div';
  return <Tag key={label} className={`budget-stat list-panel budget-tone-${tone||'neutral'}`} onClick={onClick} title={onClick?'ดูรายการเบิกจ่ายของปีนี้':undefined}><span>{label}</span><strong>{money(value)}</strong><small>{note||(onClick?'ดูรายการเบิกจ่าย →':'')}</small></Tag>;
})}</div>;}
function Suggestion({field,value,onChange,year}){
  const [term,setTerm]=useState(value);const [retry,setRetry]=useState(0);
  useEffect(()=>{const timer=setTimeout(()=>setTerm(value),200);return()=>clearTimeout(timer);},[value]);
  const key=params({field:selectorFields[field],fiscal_year:year,q:term,limit:50});
  const resource=useBudgetResource(key,signal=>request(`transactions/selectors?${key}`,signal),retry);
  const options=resource.data?.data?.options||[];
  // Preserve free-text searching; account suggestions submit their code.
  const display=options.map(o=>field==='account_code'?`${o.value} — ${o.label.replace(`${o.value} — `,'')}`:String(o.value));
  return <div className={fieldClass(value)}><span>{labels[field]}</span><SearchableDropdown label={labels[field]} value={value} onChange={v=>onChange(field==='account_code'?v.split(' — ')[0]:v)} options={display} placeholder={`ค้นหา${labels[field]}…`}/>{resource.error&&<button type="button" className="budget-link" onClick={()=>setRetry(n=>n+1)}>โหลดตัวเลือกใหม่ (ยังพิมพ์ค้นหาได้)</button>}</div>;
}
function Graph({children,label}){return <div className="budget-chart" role="group" aria-label={label}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;}
const grid=<CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false}/>;
const axis=<YAxis width={65} tick={{fill:'var(--text-secondary)',fontSize:11}} tickFormatter={v=>Intl.NumberFormat('th-TH',{notation:'compact'}).format(v)}/>;
const tip=<Tooltip formatter={(v,name)=>[money(String(Number(v).toFixed(2))),name]} contentStyle={{background:'var(--card-bg)',border:'1px solid var(--border-subtle)',borderRadius:8,color:'var(--text-primary)'}}/>;

export default function BudgetDashboard(){
  const [url,setUrl]=useState(()=>location.pathname+location.search);
  const query=readQuery();const searching=url.includes('/search');
  const year=query.fiscal_year||String(new Date().getFullYear());
  const [draft,setDraft]=useState(()=>({...query}));const [localSearch,setLocalSearch]=useState(query.q);
  const [retry,setRetry]=useState(0);const heading=useRef(null);const restore=useRef(null);const activeMonth=useRef(null);
  useEffect(()=>{if(!location.search){try{const saved=sessionStorage.getItem(`budget:last:${location.pathname}`);if(saved){history.replaceState({},'',location.pathname+saved);setUrl(location.pathname+saved);setDraft(readQuery());setLocalSearch(readQuery().q);}}catch{/* Optional persistence. */}}},[]);
  useEffect(()=>{try{if(location.search)sessionStorage.setItem(`budget:last:${location.pathname}`,location.search);}catch{/* Optional persistence. */}},[url]);
  const savePosition=()=>{try{sessionStorage.setItem(`budget:position:${location.pathname+location.search}`,JSON.stringify({y:window.scrollY,id:document.activeElement?.id}));}catch{/* Optional persistence. */}};
  useEffect(()=>{const changed=()=>{setUrl(location.pathname+location.search);setDraft(readQuery());setLocalSearch(readQuery().q);try{restore.current=JSON.parse(sessionStorage.getItem(`budget:position:${location.pathname+location.search}`)||'null');}catch{restore.current=null;}};window.addEventListener('popstate',changed);window.addEventListener('pagehide',savePosition);return()=>{window.removeEventListener('popstate',changed);window.removeEventListener('pagehide',savePosition);};},[]);
  const navigate=(next,mode=searching?'search':'summary',replace=false)=>{
    savePosition();const path=`/budget-dashboard${mode==='search'?'/search':''}?${params(next)}`;
    if(path===location.pathname+location.search)return;
    history[replace?'replaceState':'pushState']({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));
    requestAnimationFrame(()=>{heading.current?.focus();window.scrollTo({top:0,behavior:'instant'});});
  };
  const drill=(extra={})=>navigate({...readQuery(),...Object.fromEntries([...filterKeys,'q','transaction_id'].map(k=>[k,''])),fiscal_year:year,...extra,page:1},'search');
  const selectors=useBudgetResource('years',signal=>request('transactions/selectors',signal),retry);
  const years=[...new Set([String(new Date().getFullYear()),year,...(selectors.data?.data?.year||[]).map(String)])].sort().reverse();
  const summary=useBudgetResource(!searching?year:null,async signal=>{const r=await request(`dashboard/summary?fiscal_year=${year}`,signal);if(!r.data?.totals||!Array.isArray(r.data.accounts))throw new Error('รูปแบบข้อมูลสรุปไม่ถูกต้อง');return r;},retry);
  const results=useBudgetResource(searching?params(query,Object.keys(query).filter(k=>k!=='transaction_id')):null,(signal,progress)=>loadResults(query,signal,progress),retry);
  const detail=useBudgetResource(searching&&query.transaction_id?query.transaction_id:null,signal=>request(`transactions/${query.transaction_id}`,signal),retry);
  useEffect(()=>{if(query.transaction_id&&!detail.loading){const panel=document.getElementById('budget-detail');panel?.focus();panel?.scrollIntoView({block:'start'});}},[query.transaction_id,detail.loading]);
  const data=summary.data?.data;const result=results.data;const totals=result?.aggregate.totals;
  useEffect(()=>{if(searching&&result&&query.page>Math.max(1,result.pagination.total_pages))navigate({...query,page:Math.max(1,result.pagination.total_pages)},'search',true);
    if(restore.current&&!(searching?results.loading:summary.loading)){const saved=restore.current;restore.current=null;requestAnimationFrame(()=>{if(saved.id)document.getElementById(saved.id)?.focus({preventScroll:true});window.scrollTo(0,saved.y||0);});}
    // Route and result identify the context to restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[url,result,summary.loading,results.loading]);
  const retryAll=()=>setRetry(n=>n+1);
  const monthClick=(month,direction='')=>{if(!month)return;navigate({...query,posting_month:month,amount_direction:direction,page:1,transaction_id:''});};
  const displayYear=y=>`${Number(y)+543} (${y})`;
  return <div className="list-page budget-dashboard">
    <header className="list-header"><div><h1 ref={heading} tabIndex={-1}>{searching?'รายการเบิกจ่าย':'การใช้งานงบประมาณ'}</h1><p>ระบบบริหารอุปกรณ์คอมพิวเตอร์และเครือข่าย กฟฉ.2 · ปีข้อมูล ม.ค.–ธ.ค.</p></div><div className="list-actions">
      {searching?<button className="list-button" onClick={()=>navigate({fiscal_year:year},'summary')}><ArrowLeft size={18}/>ภาพรวม</button>:<label className="list-field">ปีข้อมูล<select value={year} onChange={e=>navigate({fiscal_year:e.target.value},'summary')}>{years.map(y=><option key={y} value={y}>{displayYear(y)}</option>)}</select></label>}
      <button className="list-button" onClick={retryAll}><RefreshCw size={18}/>รีเฟรช</button>{!searching&&<button className="list-button list-button-primary" onClick={()=>drill()}><Search size={18}/>ค้นหารายการ</button>}
    </div></header>
    {!searching?<><State resource={summary} retry={retryAll}/>{data&&<>
      <p className="list-muted">ช่วงข้อมูล {data.period?.start_date||'—'} ถึง {data.period?.end_date||'—'} · ข้อมูลถึง {data.period?.data_through||'—'}</p>
      <Amounts onClick={()=>drill()} values={[[ 'งบประมาณที่ได้รับ',data.totals.allocated,'','allocated'],['ใช้แล้ว (สุทธิ)',data.totals.spent,'','spent'],['คงเหลือ',data.totals.remaining,Number(data.totals.remaining)<0?'ใช้เกินงบประมาณ':'',Number(data.totals.remaining)<0?'debit':'credit'],['เฉลี่ยต่อเดือน',data.totals.average_monthly_spent,'ค่าเฉลี่ยตามข้อมูลสรุปของระบบ','net']]}/>
      {!data.accounts.length?<div className="budget-state list-panel">ยังไม่มีข้อมูลสำหรับปี {displayYear(year)}</div>:<>
      <section className="list-panel budget-panel"><h2>งบประมาณเทียบการใช้จริง</h2><p className="list-muted">คลิกแท่งกราฟเพื่อดูรายการตามบัญชี หรือเลือกบัญชีในตารางด้านล่าง · หน่วยบาท</p>
        <Graph label="งบประมาณที่ได้รับและยอดใช้สุทธิตามบัญชี"><BarChart data={chartNumbers(data.accounts)}>{grid}<XAxis dataKey="account_code" tick={{fill:'var(--text-secondary)',fontSize:11}}/>{axis}{tip}<Legend/>
          <Bar name="ได้รับ" dataKey="allocated" fill={colors.allocated} cursor="pointer" onClick={v=>drill({account_code:payload(v)?.account_code})}/><Bar name="ใช้แล้ว (สุทธิ)" dataKey="spent" fill={colors.spent} cursor="pointer" onClick={v=>drill({account_code:payload(v)?.account_code})}/>
        </BarChart></Graph>
      </section>
      <div className="budget-accounts">{data.accounts.map(account=><section key={account.account_code} className="list-panel budget-panel"><h2>{account.account_name}</h2><p className="list-muted">{account.account_code} · ผู้ใช้ที่มียอดเบิกจ่ายสุทธิสูงสุด</p>
        {account.top_users?.length?<><Graph label={`ผู้เบิกจ่ายสูงสุด ${account.account_name}`}><BarChart data={chartNumbers(account.top_users)} layout="vertical" margin={{left:8,right:16}}><XAxis type="number" hide/><YAxis type="category" dataKey="username" width={110} tick={{fill:'var(--text-secondary)',fontSize:11}}/>{tip}<Bar name="ยอดสุทธิ" dataKey="spent" fill={colors.allocated} cursor="pointer" onClick={v=>drill({account_code:account.account_code,username:payload(v)?.username})}/></BarChart></Graph>
        <details><summary>เลือกผู้ใช้เพื่อดูรายละเอียด</summary><ul className="budget-user-list">{account.top_users.map(user=><li key={user.username}><button id={`budget-user-${account.account_code}-${user.username}`} className="budget-link" onClick={()=>drill({account_code:account.account_code,username:user.username})}>{user.username} · {money(user.spent)}</button></li>)}</ul></details></>:<p>ยังไม่มีรายการเบิกจ่าย</p>}
        <button className="list-button" onClick={()=>drill({account_code:account.account_code})}>ดูรายการบัญชีนี้ทั้งหมด</button>
      </section>)}</div>
      <section className="list-panel"><h2 className="budget-panel-title">สรุปตามรหัสบัญชี</h2><div className="list-table-scroll" tabIndex={0} aria-label="ตารางสรุป เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table className="list-table budget-summary-table"><caption className="budget-sr">งบประมาณและการใช้จริงตามบัญชี หน่วยบาท</caption><thead><tr>{['รหัส / ชื่อบัญชี','ได้รับ (บาท)','ใช้สุทธิ (บาท)','คงเหลือ (บาท)','ใช้แล้ว (%)'].map((t,i)=><th key={t} scope="col" className={i?'budget-money':''}>{t}</th>)}</tr></thead><tbody>{data.accounts.map(a=><tr key={a.account_code}><td><button id={`budget-account-${a.account_code}`} className="budget-link" onClick={()=>drill({account_code:a.account_code})}>{a.account_code} · {a.account_name}</button></td>{['allocated','spent','remaining'].map(k=><td key={k} className={`budget-money budget-tone-${k==='remaining'?(Number(a[k])<0?'debit':'credit'):k}`}><strong>{money(a[k])}</strong>{k==='remaining'&&Number(a[k])<0&&<span className="budget-over-budget">เกินงบ</span>}</td>)}<td className="budget-money">{a.usage_percentage==null?'—':`${a.usage_percentage}%`}</td></tr>)}</tbody></table></div></section>
      </>}
    </>}</>:<>
      <details className="budget-filter-section" open={!query.account_code&&!query.username&&!query.posting_month}><summary>เงื่อนไขค้นหา — กดเพื่อแก้ไขตัวกรอง</summary>
      <form className="list-panel budget-filters" onSubmit={e=>{e.preventDefault();navigate({...query,...draft,page:1,transaction_id:''});}}>
        <label className={fieldClass(draft.fiscal_year)}>ปีข้อมูล<select value={draft.fiscal_year} onChange={e=>setDraft({...draft,fiscal_year:e.target.value,posting_month:''})}><option value="">ทุกปี</option>{years.map(y=><option key={y} value={y}>{displayYear(y)}</option>)}</select></label>
        {fields.map(field=><Suggestion key={field} field={field} year={draft.fiscal_year} value={draft[field]} onChange={v=>setDraft({...draft,[field]:v})}/>)}
        <label className={fieldClass(draft.posting_month)}>เดือน<input type="month" value={draft.posting_month} min={draft.fiscal_year?`${draft.fiscal_year}-01`:undefined} max={draft.fiscal_year?`${draft.fiscal_year}-12`:undefined} onChange={e=>setDraft({...draft,posting_month:e.target.value})}/></label>
        <label className={fieldClass(draft.amount_direction)}>ประเภทรายการ<select value={draft.amount_direction} onChange={e=>setDraft({...draft,amount_direction:e.target.value})}><option value="">ทั้งหมด</option><option value="debit">จ่าย</option><option value="credit">กลับรายการ</option></select></label>
        <div className="list-actions budget-filter-actions"><button className="list-button list-button-primary" type="submit">ค้นหา</button><button className="list-button" type="button" onClick={()=>{const cleared={...readQuery(),...Object.fromEntries([...filterKeys,'q','transaction_id'].map(k=>[k,''])),page:1};setDraft(cleared);setLocalSearch('');navigate(cleared);}}>ล้างทั้งหมด</button></div>
      </form></details>
      <div className="list-actions budget-chips" aria-label="ตัวกรองที่ใช้">{[...filterKeys,'q'].filter(k=>query[k]).map(k=><button key={k} className="list-button" onClick={()=>navigate({...query,[k]:'',page:1,transaction_id:'',...(k==='fiscal_year'?{posting_month:''}:{})})}>{labels[k]}: {query[k]} <X size={14} aria-label="ล้างตัวกรอง"/></button>)}</div>
      <form className="budget-local-search" onSubmit={e=>{e.preventDefault();navigate({...query,q:localSearch,page:1,transaction_id:''});}}><label className={fieldClass(localSearch)}>ค้นหาในผลลัพธ์ทั้งหมด<input type="search" value={localSearch} onChange={e=>setLocalSearch(e.target.value)} placeholder="ค้นหาข้ามคอลัมน์ทุกหน้า"/></label><button className="list-button" type="submit">ค้นหาในผลลัพธ์</button></form>
      <State resource={results} retry={retryAll}/>
      {result&&<>
        <p role="status">พบ {result.pagination.total_items.toLocaleString()} รายการ · <span className="list-muted">ยอดรวมตามตัวกรองทั้งหมด ไม่ใช่เฉพาะหน้านี้</span></p>
        <Amounts values={[[ 'ยอดจ่าย',totals.debit,'','debit'],['ยอดกลับรายการ',totals.credit,'จำนวนเงินติดลบ','credit'],['ยอดจ่ายสุทธิ',totals.net,'','net']]}/>
        <section className="list-panel budget-panel"><h2>ยอดรายเดือน</h2><p className="list-muted">แตะแท่งหรือจุดบนเส้นเพื่อดูรายการเดือนนั้น · เส้นแสดงยอดสุทธิ หน่วยบาท</p>
          {query.posting_month&&<button className="list-button" onClick={()=>navigate({...query,posting_month:'',amount_direction:'',page:1})}>ดูทุกเดือน</button>}
          <Graph label="ยอดจ่าย กลับรายการ และยอดสุทธิรายเดือน"><ComposedChart data={chartNumbers(result.aggregate.by_month)} onMouseMove={s=>{activeMonth.current=s?.activeLabel;}}>{grid}<XAxis dataKey="month" tickFormatter={monthLabel} tick={{fill:'var(--text-secondary)',fontSize:11}}/>{axis}{tip}<Legend/>
            <Bar dataKey="debit" name="จ่าย" fill={colors.debit} cursor="pointer" onClick={v=>monthClick(payload(v)?.month,'debit')}/><Bar dataKey="credit" name="กลับรายการ" fill={colors.credit} cursor="pointer" onClick={v=>monthClick(payload(v)?.month,'credit')}/>
            <Line dataKey="net" name="สุทธิ" stroke={colors.net} strokeWidth={3} dot={p=><circle key={p.key} cx={p.cx} cy={p.cy} r={7} fill={colors.net} cursor="pointer" onClick={e=>{e.stopPropagation();monthClick(p.payload?.month);}}/>} activeDot={p=><circle key={p.key} cx={p.cx} cy={p.cy} r={10} fill={colors.net} cursor="pointer" onClick={e=>{e.stopPropagation();monthClick(p.payload?.month);}}/>} onClick={()=>monthClick(activeMonth.current)} cursor="pointer"/>
          </ComposedChart></Graph>
          <details><summary>เลือกเดือนและดูตัวเลขเต็ม</summary><ul className="budget-user-list">{result.aggregate.by_month.map(m=><li key={m.month}><button className="budget-link" onClick={()=>monthClick(m.month)}>{monthLabel(m.month)} · สุทธิ {money(m.net)}</button><span className="list-muted">จ่าย {money(m.debit)} · กลับรายการ {money(m.credit)}</span></li>)}</ul></details>
          {result.aggregate.coverage?.records_without_posting_date>0&&<p className="list-muted">มี {result.aggregate.coverage.records_without_posting_date} รายการไม่ระบุวันที่ รวมอยู่ในยอดรวมแต่ไม่อยู่ในกราฟเดือน</p>}
        </section>
        {!result.rows.length?<div className="budget-state list-panel">ไม่พบรายการตามเงื่อนไข ลองล้างตัวกรองหรือเปลี่ยนปี</div>:<section className="list-panel"><div className="list-table-scroll" tabIndex={0} aria-label="รายการธุรกรรม เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table className="list-table budget-table"><caption className="budget-sr">รายการเบิกจ่าย คลิกเลขเอกสารเพื่อดูรายละเอียดเต็ม</caption><thead><tr>{columns.map(([k,label])=><th key={k} scope="col" aria-sort={query.sort===k?(query.order==='asc'?'ascending':'descending'):undefined}>{sorts.includes(k)?<button className="list-sort" onClick={()=>navigate({...query,sort:k,order:query.sort===k&&query.order==='asc'?'desc':'asc',page:1})}>{label} {query.sort===k?(query.order==='asc'?'↑':'↓'):'↕'}</button>:label}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr key={row.transaction_id}>{columns.map(([k])=><td key={k} title={String(row[k]??'—')} className={k==='amount'?'budget-money':''}>{k==='reference_doc_no'?<button id={`budget-row-${row.transaction_id}`} className="budget-link" onClick={()=>navigate({...query,transaction_id:row.transaction_id})}>{row[k]||'ดูรายละเอียด'}</button>:k==='amount'?money(row[k]):String(row[k]??'—')}</td>)}</tr>)}</tbody></table></div></section>}
        <footer className="list-footer"><span>{result.pagination.total_items?((query.page-1)*query.page_size+1):0}–{Math.min(query.page*query.page_size,result.pagination.total_items)} จาก {result.pagination.total_items} รายการ</span><div className="list-pagination"><label>แถวต่อหน้า<select value={query.page_size} onChange={e=>navigate({...query,page_size:Number(e.target.value),page:1})}>{[10,15,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label><button className="list-button" disabled={query.page<=1} onClick={()=>navigate({...query,page:query.page-1})}>ก่อนหน้า</button><label>หน้า<select value={query.page} onChange={e=>navigate({...query,page:Number(e.target.value)})}>{Array.from({length:Math.max(query.page,result.pagination.total_pages,1)},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label><button className="list-button" disabled={query.page>=result.pagination.total_pages} onClick={()=>navigate({...query,page:query.page+1})}>ถัดไป</button></div></footer>
      </>}
      {query.transaction_id&&<section id="budget-detail" tabIndex={-1} className="list-panel budget-panel" aria-label="รายละเอียดธุรกรรม"><h2>รายละเอียดธุรกรรม #{query.transaction_id}</h2><button className="list-button" onClick={()=>navigate({...query,transaction_id:''})}>ปิดรายละเอียด</button><State resource={detail} retry={retryAll}/>{detail.data&&<dl className="budget-detail">{columns.map(([k,label])=><div key={k}><dt>{label}</dt><dd>{k==='amount'?money(detail.data.data[k]):String(detail.data.data[k]??'—')}</dd></div>)}</dl>}</section>}
    </>}
  </div>;
}
