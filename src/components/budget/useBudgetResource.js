import {useEffect,useState} from 'react';
import {request,aggregateRows,params,filterKeys} from './budgetData';
export default function useBudgetResource(key,loader,retry=0){
  const [state,setState]=useState({key:null,data:null,error:'',loading:true,progress:''});
  useEffect(()=>{if(!key)return;const controller=new AbortController();let active=true;
    const timeout=setTimeout(()=>controller.abort(),120000);
    setState({key,data:null,error:'',loading:true,progress:''});
    loader(controller.signal,progress=>{if(active)setState(s=>({...s,progress}));})
      .then(data=>{if(active)setState({key,data,error:'',loading:false,progress:''});})
      .catch(error=>{if(active)setState({key,data:null,error:error.name==='AbortError'?'ใช้เวลาโหลดนานเกินไป กรุณาลองใหม่':error.message,loading:false,progress:''});})
      .finally(()=>clearTimeout(timeout));
    return()=>{active=false;clearTimeout(timeout);controller.abort();};
    // key includes every loader input; abort prevents older results winning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,retry]);
  return state.key===key?state:{data:null,error:'',loading:Boolean(key),progress:''};
}
export async function loadResults(query,signal,progress){
  const filters=params(query,filterKeys);
  const q=query.q.trim();
  // Server-side q (literal-v1) covers every filtered record. Its presence is
  // confirmed from meta.search.version, never from HTTP 200 alone.
  const serverFilters=q?`${filters}&${params({q},['q'])}`:filters;
  const [list,aggregate]=await Promise.all([request(`transactions?${serverFilters}&${params(query,['page','page_size','sort','order'])}`,signal),request(`transactions/aggregates?${serverFilters}`,signal)]);
  if(!Array.isArray(list.data)||!list.pagination||!aggregate.data?.totals||!Array.isArray(aggregate.data.by_month))throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  if(!q||(list.meta?.search?.version==='literal-v1'&&aggregate.meta?.search?.version==='literal-v1'))return {rows:list.data,pagination:list.pagination,aggregate:aggregate.data,meta:list.meta};
  // Older backend ignores q: search the complete filtered set, never one page.
  let rows=[];let page=1;let pages=1;
  do{const r=await request(`transactions?${filters}&page=${page}&page_size=100&${params(query,['sort','order'])}`,signal);
    if(!Array.isArray(r.data)||!r.pagination)throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
    rows.push(...r.data);pages=Number(r.pagination.total_pages);progress(`กำลังค้นหา ${rows.length.toLocaleString()} / ${r.pagination.total_items.toLocaleString()} รายการ`);page++;
  }while(page<=pages);
  const needle=query.q.trim().toLocaleLowerCase();
  rows=[...new Map(rows.map(r=>[r.transaction_id,r])).values()].filter(row=>Object.entries(row).some(([k,v])=>k!=='linked_job_count'&&String(v??'').toLocaleLowerCase().includes(needle)));
  return {rows:rows.slice((query.page-1)*query.page_size,query.page*query.page_size),pagination:{page:query.page,page_size:query.page_size,total_items:rows.length,total_pages:Math.ceil(rows.length/query.page_size)},aggregate:aggregateRows(rows,query.fiscal_year),meta:{generated_at:new Date().toISOString()}};
}
