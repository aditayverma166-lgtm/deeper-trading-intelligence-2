
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const BASE = "https://api.india.delta.exchange";

function json(res, code, data) {
  res.writeHead(code, {"Content-Type":"application/json","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers: {"User-Agent":"deeper-trading-intelligence/1.0"}}, r => {
      let body = "";
      r.on("data", c => body += c);
      r.on("end", () => {
        try { resolve({status:r.statusCode, data:JSON.parse(body)}); }
        catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a,b)=>a+b,0)/period;
  for (let i=period;i<values.length;i++) e = values[i]*k + e*(1-k);
  return e;
}

function rsi(values, period=14) {
  if (values.length <= period) return null;
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){
    const d=values[i]-values[i-1];
    if(d>=0) gains+=d; else losses-=d;
  }
  let avgG=gains/period, avgL=losses/period;
  for(let i=period+1;i<values.length;i++){
    const d=values[i]-values[i-1];
    const g=Math.max(d,0), l=Math.max(-d,0);
    avgG=(avgG*(period-1)+g)/period;
    avgL=(avgL*(period-1)+l)/period;
  }
  if(avgL===0) return 100;
  return 100 - 100/(1+avgG/avgL);
}

function atr(candles, period=14) {
  if(candles.length <= period) return null;
  const tr=[];
  for(let i=1;i<candles.length;i++){
    const c=candles[i], p=candles[i-1];
    tr.push(Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close)));
  }
  let a=tr.slice(0,period).reduce((x,y)=>x+y,0)/period;
  for(let i=period;i<tr.length;i++) a=(a*(period-1)+tr[i])/period;
  return a;
}

async function candles(symbol, resolution, limit=500) {
  const end=Math.floor(Date.now()/1000);
  const seconds = {1m:60,3m:180,5m:300,15m:900,30m:1800,1h:3600,2h:7200,4h:14400,1d:86400}[resolution] || 900;
  const start=end-seconds*limit;
  const url=`${BASE}/v2/history/candles?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&start=${start}&end=${end}`;
  const out=await get(url);
  if(out.status>=400 || !out.data?.result) throw new Error("Delta candle API error");
  const rows=out.data.result;
  return rows.map(x=>({
    time:Number(x.time),
    open:Number(x.open),
    high:Number(x.high),
    low:Number(x.low),
    close:Number(x.close),
    volume:Number(x.volume||0)
  })).sort((a,b)=>a.time-b.time);
}

function analyze(cs) {
  const closes=cs.map(x=>x.close);
  const last=cs.at(-1);
  const e9=ema(closes,9), e20=ema(closes,20), r=rsi(closes), a=atr(cs);
  const recent=cs.slice(-20);
  const swingHigh=Math.max(...recent.map(x=>x.high));
  const swingLow=Math.min(...recent.map(x=>x.low));
  let verdict="WAIT";
  if(e9 && e20 && e9>e20 && last.close>e20 && r>=50 && r<75) verdict="LONG";
  if(e9 && e20 && e9<e20 && last.close<e20 && r<=50 && r>25) verdict="SHORT";
  const risk=Math.max(a||Math.abs(swingHigh-swingLow)*0.15, last.close*0.001);
  let sl,tp1,tp2;
  if(verdict==="LONG"){
    sl=last.close-risk; tp1=last.close+risk*1.5; tp2=last.close+risk*2.5;
  } else if(verdict==="SHORT"){
    sl=last.close+risk; tp1=last.close-risk*1.5; tp2=last.close-risk*2.5;
  } else {
    sl=last.close-risk; tp1=last.close+risk*1.5; tp2=last.close+risk*2.5;
  }
  return {
    verdict, price:last.close, ema9:e9, ema20:e20, rsi:r, atr:a,
    swingHigh, swingLow, entry:last.close, sl, tp1, tp2,
    trend: e9>e20 ? "Bullish" : "Bearish"
  };
}

async function handle(req,res){
  const u=new URL(req.url,`http://${req.headers.host}`);
  try{
    if(u.pathname==="/api/health") return json(res,200,{ok:true});
    if(u.pathname==="/api/candles"){
      const symbol=u.searchParams.get("symbol")||"BTCUSD";
      const resolution=u.searchParams.get("resolution")||"5m";
      const limit=Math.min(Number(u.searchParams.get("limit")||500),2000);
      return json(res,200,{symbol,resolution,data:await candles(symbol,resolution,limit)});
    }
    if(u.pathname==="/api/analyze"){
      const symbol=u.searchParams.get("symbol")||"BTCUSD";
      const resolution=u.searchParams.get("resolution")||"5m";
      const cs=await candles(symbol,resolution,500);
      return json(res,200,{symbol,resolution,analysis:analyze(cs)});
    }
    const file = u.pathname === "/" ? "/index.html" : u.pathname;
    const fp=path.normalize(path.join(public,file));
    if(!fp.startsWith(public)) return json(res,403,{error:"Forbidden"});
    if(fs.existsSync(fp) && fs.statSync(fp).isFile()){
      const ext=path.extname(fp);
      const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
      res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});
      fs.createReadStream(fp).pipe(res); return;
    }
    json(res,404,{error:"Not found"});
  }catch(e){ json(res,500,{error:e.message}); }
}
http.createServer(handle).listen(PORT,()=>console.log(`Deeper Trading Intelligence running on ${PORT}`));
