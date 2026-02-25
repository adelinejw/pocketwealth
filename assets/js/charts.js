// App-specific charts
function initAppCharts(data){
  try{
    const allocationCtx = document.getElementById('appAllocation')?.getContext('2d');
    const perfCtx = document.getElementById('appPerformance')?.getContext('2d');
    const portfolios = data.portfolios?.portfolios || [];
    const defaultP = portfolios.find(p=>p.id==='balanced') || portfolios[0];
    if(allocationCtx && defaultP){
      const labels = Object.keys(defaultP.allocation);
      const values = labels.map(k=>defaultP.allocation[k]);
      new Chart(allocationCtx,{type:'doughnut',data:{labels, datasets:[{data:values, backgroundColor:['#0A84FF','#4FB7F3','#22C55E','#F59E0B']} ]}, options:{responsive:true,plugins:{legend:{position:'bottom'}}}});
    }
    if(perfCtx){
      // simulate monthly returns for demo
      const months = Array.from({length:12},(_,i)=>['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]);
      const simulated = months.map((m,i)=>100 + (i*5) + (Math.sin(i/2)*6));
      new Chart(perfCtx,{type:'line',data:{labels:months,datasets:[{label:'Simulated Value',data:simulated,fill:true,backgroundColor:'rgba(10,132,255,0.12)',borderColor:'#0A84FF',tension:0.24}]},options:{responsive:true,plugins:{legend:{display:false}}}});
    }
  }catch(e){console.error(e)}
}
window.initAppCharts = initAppCharts;
