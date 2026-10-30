
(function(){
var KEY='fuelDriverV1', S={cap:0,stops:[],price:{},doneIds:[],pts:0,streak:0,rem:{iv:60,t:['','','']}};
var storageProblem='', ALLOWED_FUELS=['بنزین معمولی','بنزین سوپر','نفت سفید','گازوئیل'];
function asciiDigits(v){return String(v==null?'':v).replace(/[۰-۹]/g,function(c){return String(c.charCodeAt(0)-1776)}).replace(/[٠-٩]/g,function(c){return String(c.charCodeAt(0)-1632)}).replace(/[٫]/g,'.')}
function numberValue(v){var t=asciiDigits(v).replace(/[٬,،\s]/g,'').trim();if(!t)return NaN;var n=Number(t);return Number.isFinite(n)?n:NaN}
function normalizeState(raw){
  var base={cap:0,stops:[],price:{},doneIds:[],pts:0,streak:0,rem:{iv:60,t:['','','']}};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return base;
  var out=Object.assign({},base);Object.keys(raw).forEach(function(k){if(k!=='__proto__'&&k!=='prototype'&&k!=='constructor')out[k]=raw[k]});
  out.cap=Math.max(0,numberValue(out.cap)||0);
  out.stops=Array.isArray(out.stops)?out.stops.filter(function(x){return x&&typeof x==='object'&&numberValue(x.lit)>0}).map(function(x,i){
    var y=Object.assign({},x,{lit:numberValue(x.lit),done:!!x.done});
    var id=numberValue(x.id);y.id=Number.isFinite(id)&&id>0?id:(Date.now()+i);
    y.name=String(x.name||'مشتری').slice(0,100);y.addr=String(x.addr||'').slice(0,500);y.phone=asciiDigits(x.phone||'').replace(/[^0-9+]/g,'').slice(0,20);
    y.fuel=ALLOWED_FUELS.indexOf(x.fuel)>=0?x.fuel:'بنزین معمولی';y.q=!!x.q;y.day=String(x.day||(x.q?raw.qd||'':''));y.car=String(x.car||'').slice(0,80);
    var plate=normalizePlate(x.plate||'');y.plate=plate.valid?plate.value:'';
    if(y.amt!=null){var a=numberValue(y.amt);y.amt=Number.isFinite(a)&&a>=0?a:null}
    if(y.unitPrice!=null){var u=numberValue(y.unitPrice);y.unitPrice=Number.isFinite(u)&&u>=0?u:0}
    y.priceLocked=!!x.priceLocked;
    return y
  }):[];
  out.price=out.price&&typeof out.price==='object'&&!Array.isArray(out.price)?out.price:{};var cleanPrices={};ALLOWED_FUELS.forEach(function(k){var v=numberValue(out.price[k]);cleanPrices[k]=Number.isFinite(v)&&v>=0?v:0});out.price=cleanPrices;
  out.name=String(out.name||'').slice(0,80);out.loc=String(out.loc||'').slice(0,200);out.qf=ALLOWED_FUELS.indexOf(out.qf)>=0?out.qf:'بنزین معمولی';
  out.doneIds=Array.isArray(out.doneIds)?out.doneIds.map(numberValue).filter(function(v){return Number.isFinite(v)}):[];
  out.rem=out.rem&&typeof out.rem==='object'?out.rem:{iv:60,t:['','','']};
  out.rem.t=Array.isArray(out.rem.t)?out.rem.t.slice(0,3):['','',''];
  while(out.rem.t.length<3)out.rem.t.push('');
  out.pts=Math.max(0,numberValue(out.pts)||0);out.streak=Math.max(0,numberValue(out.streak)||0);
  return out;
}
try{var r=localStorage.getItem(KEY);if(r)S=normalizeState(JSON.parse(r))}catch(e){storageProblem='ذخیره‌سازی مرورگر قابل خواندن نبود؛ پیش از ادامه، از اطلاعات فعلی نسخه پشتیبان بگیرید.'}
function updateStorageStatus(){var el=document.getElementById('storageWarn');if(!el)return;if(storageProblem){el.hidden=false;el.style.display='block';el.textContent=storageProblem}else{el.hidden=true;el.style.display='none'}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));storageProblem='';updateStorageStatus();return true}catch(e){storageProblem='ذخیره‌سازی مرورگر در دسترس نیست یا فضای آن پر شده است. اطلاعات تا بسته‌شدن صفحه ممکن است از دست برود؛ فایل پشتیبان بگیرید.';updateStorageStatus();return false}}
var $=function(i){return document.getElementById(i)};
var fa=function(n){return Number(n||0).toLocaleString('fa-IR')};
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function deliveredLiters(){var n=0;S.stops.forEach(function(x){if(x.done)n+=Number(x.lit)||0});return n}
function pendingLiters(){var n=0;S.stops.forEach(function(x){if(!x.done)n+=Number(x.lit)||0});return n}
function tankRemaining(){return Math.max(0,(Number(S.cap)||0)-deliveredLiters())}
function normalizePlate(v){
  var t=asciiDigits(v).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
  if(!t)return {value:'',key:'',valid:true};
  var m=t.match(/^(\d{2})\s*([آ-ی])\s*(\d{3})\s*(?:ایران\s*)?(\d{2})$/u);
  if(!m)return {value:t,key:t.replace(/\s/g,'').toLowerCase(),valid:false};
  var value=m[1]+' '+m[2]+' '+m[3]+' ایران '+m[4];
  return {value:value,key:(m[1]+m[2]+m[3]+m[4]).toLowerCase(),valid:true};
}
function hasAmount(x){if(x.amt!=null)return true;if(x.unitPrice!=null)return Number(x.unitPrice)>0;if(x.priceLocked)return false;return Number(S.price[x.fuel]||0)>0}
function amtOf(x){if(x.amt!=null)return Number(x.amt)||0;if(x.unitPrice!=null)return Number(x.lit)*Number(x.unitPrice||0);if(x.priceLocked)return 0;return Number(x.lit)*Number(S.price[x.fuel]||0)}
function amtLabel(x){return hasAmount(x)?fa(amtOf(x))+' تومان':'مبلغ ثبت نشده'}

function render(){
  var plan=0,done=0,by={};
  S.stops.forEach(function(s){plan+=s.lit;if(s.done){done+=s.lit}by[s.fuel]=(by[s.fuel]||0)+(s.done?0:s.lit)});
  var left=S.cap-done, pending=plan-done;
  $('cap').value=S.cap||'';
  updateStorageStatus();
  $('sPlan').textContent=fa(plan);$('sDone').textContent=fa(done);$('sLeft').textContent=fa(Math.max(left,0));
  $('prog').style.width=plan?Math.min(100,done/plan*100)+'%':'0';
  var w=$('warn');
  if(S.cap>0&&pending>left){w.style.display='block';w.textContent='هشدار ظرفیت: سفارش‌های باز '+fa(pending)+' لیتر است، اما فقط '+fa(left)+' لیتر در تانکر باقی مانده.'}
  else if(!S.cap&&S.stops.length){w.style.display='block';w.textContent='ظرفیت بار تانکر ثبت نشده است؛ برای کنترل موجودی، مقدار بار را وارد کنید.'}
  else w.style.display='none';
  var list=$('list');
  if(!S.stops.length){list.innerHTML='<div class="card empty">هنوز مقصدی اضافه نشده. اولین مشتری را بالا وارد کنید.</div>'}
  else{
    var sorted=S.stops.slice().sort(function(a,b){return (a.done?1:0)-(b.done?1:0)});
    list.innerHTML=sorted.map(function(s){
      var map='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(s.addr);
      return '<article class="card stop'+(s.done?' done':'')+'"><h3>'+esc(s.name)+'</h3><p>'+esc(s.addr)+'</p>'
      +'<div style="margin-bottom:8px"><span class="tag">'+esc(s.fuel)+'</span><span class="tag">'+fa(s.lit)+' لیتر</span></div>'
      +'<div class="row"><button data-t="'+s.id+'">'+(s.done?'برگشت به انتظار':'تحویل شد')+'</button>'
      +'<a class="btn" href="'+map+'" target="_blank" rel="noopener">مسیریابی</a>'
      +(s.phone?'<a class="btn" href="tel:'+esc(s.phone)+'">تماس</a>':'')
      +'<button class="del" data-d="'+s.id+'" aria-label="حذف '+esc(s.name)+'">حذف</button></div></article>'
    }).join('');
  }
  var bf=$('byFuel'),keys=Object.keys(by).filter(function(k){return by[k]>0});
  if(keys.length){bf.style.display='block';bf.innerHTML='<b>مانده برای تحویل به تفکیک سوخت</b><div style="margin-top:6px">'+keys.map(function(k){return '<span class="tag">'+esc(k)+': '+fa(by[k])+' لیتر</span>'}).join('')+'</div>'}
  else bf.style.display='none';
}

$('cap').addEventListener('change',function(){var v=numberValue(this.value);if(!Number.isFinite(v)||v<0){alert('ظرفیت تانکر باید عددی مثبت یا صفر باشد.');render();return}if(v<deliveredLiters()){alert('ظرفیت جدید نمی‌تواند از مقدار تحویل‌شده کمتر باشد.');render();return}S.cap=v;save();render()});
$('add').addEventListener('click',function(){
  var n=$('name').value.trim(),a=$('addr').value.trim(),l=numberValue($('lit').value),ph=asciiDigits($('phone').value).replace(/[\s-]/g,'');
  if(!n||!a||!Number.isFinite(l)||!(l>0&&l<=100000)){alert('نام، آدرس و مقدار معتبر بین ۱ تا ۱۰۰٬۰۰۰ لیتر را وارد کنید.');return}
  if(n.length>100||a.length>500){alert('نام مشتری یا آدرس بیش از حد طولانی است.');return}
  if(ph&&!/^0\d{10}$/.test(ph)){alert('شماره تماس باید ۱۱ رقم و با صفر شروع شود؛ یا آن را خالی بگذارید.');return}
  if(S.cap>0&&pendingLiters()+l>tankRemaining()){alert('این سفارش از موجودی آزاد تانکر بیشتر است. ابتدا ظرفیت یا سفارش‌های باز را اصلاح کنید.');return}
  S.stops.push({id:Date.now(),name:n,addr:a,phone:ph,fuel:$('fuel').value,lit:l,done:false});
  ['name','addr','phone','lit'].forEach(function(i){$(i).value=''});
  save();render();
});
$('list').addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t)return;
  if(t.dataset.t){var target=S.stops.filter(function(s){return s.id==t.dataset.t})[0];if(!target)return;if(!target.done&&S.cap>0&&target.lit>tankRemaining()){alert('تحویل ثبت نشد؛ موجودی تانکر برای این مقدار کافی نیست.');return}target.done=!target.done}
  else if(t.dataset.d){if(!confirm('این مقصد حذف شود؟'))return;S.stops=S.stops.filter(function(s){return s.id!=t.dataset.d})}
  else return;
  save();render();
});
$('clear').addEventListener('click',function(){
  if(!confirm('همه تحویل‌های انجام‌شده از فهرست و گزارش محلی حذف می‌شوند و ظرفیت به‌روزرسانی می‌شود. قبل از ادامه، فایل پشتیبان بگیرید. ادامه می‌دهید؟'))return;
  var d=0;S.stops.forEach(function(s){if(s.done)d+=s.lit});
  S.cap=Math.max(0,S.cap-d);S.stops=S.stops.filter(function(s){return !s.done});save();render();
});
/* ---- voice ---- */
var SR=window.SpeechRecognition||window.webkitSpeechRecognition,rec,on=false,speaking=false;
var W={'یک':1,'دو':2,'سه':3,'چهار':4,'پنج':5,'شش':6,'هفت':7,'هشت':8,'ده':10};
function say(t){$('vlog').textContent=t;
  try{var u=new SpeechSynthesisUtterance(t);u.lang='fa-IR';speaking=true;u.onend=function(){speaking=false};setTimeout(function(){speaking=false},4000);speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){speaking=false}}
var NUMBER_WORDS={'صفر':0,'یک':1,'يک':1,'دو':2,'سه':3,'چهار':4,'پنج':5,'شش':6,'هفت':7,'هشت':8,'نه':9,'ده':10,'یازده':11,'دوازده':12,'سیزده':13,'چهارده':14,'پانزده':15,'شانزده':16,'هفده':17,'هجده':18,'نوزده':19,'بیست':20,'سی':30,'چهل':40,'پنجاه':50,'شصت':60,'هفتاد':70,'هشتاد':80,'نود':90,'صد':100,'یکصد':100,'دویست':200,'سیصد':300,'چهارصد':400,'پانصد':500,'ششصد':600,'هفتصد':700,'هشتصد':800,'نهصد':900,'هزار':1000};
function persianNumberWords(text){var tokens=text.trim().split(/\s+/),total=0,current=0,seen=false;for(var i=0;i<tokens.length;i++){var w=tokens[i];if(w==='و')continue;if(!(w in NUMBER_WORDS))return null;seen=true;if(w==='هزار'){total+=(current||1)*1000;current=0}else current+=NUMBER_WORDS[w]}return seen?total+current:null}
function norm(t){
  t=asciiDigits(t).replace(/[,٬،](?=\d)/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک');
  var words=Object.keys(NUMBER_WORDS).sort(function(a,b){return b.length-a.length}).join('|');
  var re=new RegExp('(^|\\s)((?:(?:'+words+')(?:\\s+و)?\\s*)+)(?=\\s*(?:لیتر|تومان))','g');
  t=t.replace(re,function(m,lead,phrase){var n=persianNumberWords(phrase);return n==null?m:lead+n});
  t=t.replace(/(\d+)\s*هزار/g,function(m,n){return +n*1000});
  return t;
}

function process(raw){
  var t=norm(raw),fuel=(t.match(/بنزین|گازوئیل|نفت/)||[])[0];
  var lm=t.match(/(\d{1,6})\s*لیتر/)||t.match(/(?:^|\s)(\d{1,6})(?=\s|$)/),lit=lm?+lm[1]:0;
  if(/باقی|مونده|مانده/.test(t)&&/چقدر|چند|\?|؟/.test(t)){
    var d=0;S.stops.forEach(function(s){if(s.done)d+=s.lit});say('در تانکر '+fa(Math.max(S.cap-d,0))+' لیتر باقی مانده است.');return}
  if(/تحویل\s*(شد|دادم|گرفت)|تموم شد|تمام شد|انجام شد/.test(t)){
    var p=S.stops.filter(function(s){return !s.done}),hit=p.filter(function(s){return s.name.split(/\s+/).some(function(w){return w.length>2&&!/^(آقای|خانم|شرکت|جناب)$/.test(w)&&t.indexOf(w)>-1})})[0]||p[0];
    if(!hit){say('مقصد در انتظار وجود ندارد.');return}
    if(S.cap>0&&hit.lit>tankRemaining()){say('تحویل ثبت نشد؛ موجودی تانکر برای این مقصد کافی نیست.');return}
    hit.done=true;save();render();say('تحویل '+hit.name+' ثبت شد.');return}
  if(!fuel&&/بار|تانکر/.test(t)&&lit){S.cap=lit;save();render();say('بار تانکر '+fa(lit)+' لیتر ثبت شد.');return}
  if(fuel&&lit){
    if(S.cap>0&&pendingLiters()+lit>tankRemaining()){say('این سفارش از موجودی آزاد تانکر بیشتر است؛ ابتدا بار تانکر یا سفارش‌ها را اصلاح کنید.');return}
    var ph=(t.match(/0?9\d{9}|0\d{10}/)||[])[0]||'';
    var am=t.match(/آدرس\s+(.+?)(?=\s+(?:تلفن|شماره|موبایل)|$)/),addr=am?am[1].replace(ph,'').trim():'';
    var nm=t.match(/(?:برای|مشتری)\s+(.+?)(?=\s+(?:آدرس|تلفن|شماره|موبایل|بنزین|گازوئیل|نفت|\d)|$)/),name=nm?nm[1]:'مشتری';
    S.stops.push({id:Date.now(),name:name,addr:addr,phone:ph,fuel:fuelName(t),lit:lit,done:false});
    save();render();say('ثبت شد: '+fuel+' '+fa(lit)+' لیتر برای '+name+(addr?'':'. آدرس ثبت نشد.'));return}
  say('متوجه نشدم: '+raw)}
function ui(){var m=$('mic');m.className='mic'+(on?' on':'');m.textContent=on?'⏹ در حال گوش‌دادن… (برای توقف بزنید)':'🎤 شروع گوش‌دادن';if(!on)$('live').textContent=''}
$('mic').addEventListener('click',function(){
  if(!SR){say('این مرورگر تشخیص صدا ندارد. از Chrome اندروید استفاده کنید.');return}
  if(on){on=false;rec.stop();ui();return}
  rec=new SR();rec.lang='fa-IR';rec.continuous=true;rec.interimResults=true;
  rec.onresult=function(e){for(var i=e.resultIndex;i<e.results.length;i++){var r=e.results[i];if(r.isFinal){$('live').textContent=r[0].transcript;if(!speaking)process(r[0].transcript)}else $('live').textContent=r[0].transcript}};
  rec.onerror=function(e){if(e.error==='no-speech'){ $('live').textContent='صدایی دریافت نشد؛ دوباره صحبت کنید.';return }on=false;ui();var msg=e.error==='not-allowed'||e.error==='service-not-allowed'?'دسترسی میکروفون داده نشد. اجازه میکروفون را در تنظیمات مرورگر فعال کنید.':e.error==='network'?'تشخیص صدا به اینترنت نیاز دارد یا اتصال قطع شده است. از ورود دستی استفاده کنید.':e.error==='audio-capture'?'میکروفون پیدا نشد یا در دسترس نیست.':'تشخیص صدا متوقف شد؛ اطلاعات را دستی وارد کنید.';say(msg)};
  rec.onend=function(){if(on){try{rec.start()}catch(x){on=false;ui()}}else ui()};
  on=true;try{rec.start()}catch(x){on=false}ui();
});
/* ---- luxury extras ---- */
var FU=['بنزین معمولی','بنزین سوپر','نفت سفید','گازوئیل'];S.price=S.price||{};
FU.forEach(function(f,i){var e=$('p'+i);e.value=S.price[f]||'';e.addEventListener('change',function(){var v=numberValue(this.value);if(!Number.isFinite(v)||v<0){alert('قیمت باید عددی مثبت یا صفر باشد.');this.value=S.price[f]||'';return}S.price[f]=v;save();render()})});
var _r=render;render=function(){_r();var d=0,rev=0,unknown=0;
  S.stops.forEach(function(s){if(s.done){d+=s.lit;if(hasAmount(s))rev+=amtOf(s);else unknown++}});
  var left=Math.max(S.cap-d,0),ratio=S.cap?left/S.cap:0,h=new Date().getHours();
  $('arc').style.strokeDashoffset=251.3*(1-ratio);$('gl').textContent=fa(left);
  $('rev').textContent='فروش ثبت‌شده: '+fa(rev)+' تومان'+(unknown?' | مبلغ '+fa(unknown)+' مورد نامشخص':'');
  $('hello').textContent=(h<5?'شب':h<12?'صبح':h<17?'ظهر':h<20?'عصر':'شب')+' بخیر، '+(S.name||'راننده')+' عزیز'};
var _s=say;say=function(t){try{navigator.vibrate(40)}catch(e){}_s(t)};
function rep(){
  var dn=S.stops.filter(function(s){return s.done}),L=0,R=0;
  var tx='گزارش تحویل سوخت — '+new Date().toLocaleDateString('fa-IR')+'\nتحویل‌شده: '+fa(dn.length)+' از '+fa(S.stops.length)+' مقصد\n';
  dn.forEach(function(s){L+=s.lit;R+=amtOf(s);tx+='• '+s.name+' — '+s.fuel+' '+fa(s.lit)+' لیتر\n'});
  tx+='جمع: '+fa(L)+' لیتر | فروش: '+fa(R)+' تومان\nباقی‌مانده تانکر: '+fa(Math.max(S.cap-L,0))+' لیتر';
  if(navigator.share){navigator.share({text:tx}).catch(function(){})}
  else{try{navigator.clipboard.writeText(tx);say('گزارش کپی شد. در پیام‌رسان بچسبانید.')}catch(e){say('ارسال گزارش در این مرورگر ممکن نیست.')}}}
$('report').addEventListener('click',rep);
function exportBackup(){
  try{var payload={format:'sookhtresan-backup',version:2,exportedAt:new Date().toISOString(),data:S};
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='sookhtresan-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);say('فایل پشتیبان آماده شد؛ آن را در محل امن نگهداری کنید.');
  }catch(e){say('ساخت فایل پشتیبان ناموفق بود. فضای دستگاه یا مجوز دانلود را بررسی کنید.')}}
$('backup').addEventListener('click',exportBackup);
$('restoreBackup').addEventListener('click',function(){$('restoreFile').click()});
$('restoreFile').addEventListener('change',function(){var f=this.files&&this.files[0];if(!f)return;if(f.size>10*1024*1024){say('حجم فایل پشتیبان بیشتر از ۱۰ مگابایت است.');this.value='';return}var reader=new FileReader();reader.onload=function(){try{var v=JSON.parse(String(reader.result||'')),data=v&&v.format==='sookhtresan-backup'?v.data:v;if(!data||!Array.isArray(data.stops))throw new Error('invalid');if(!confirm('بازیابی، اطلاعات فعلی همین مرورگر را با محتوای فایل جایگزین می‌کند. قبل از ادامه از داده فعلی پشتیبان بگیرید. ادامه می‌دهید؟'))return;S=normalizeState(data);save();render();say('اطلاعات پشتیبان بازیابی شد.')}catch(e){say('فایل پشتیبان معتبر نیست یا قابل خواندن نیست.')}finally{$('restoreFile').value=''}};reader.onerror=function(){say('خواندن فایل پشتیبان ناموفق بود.');$('restoreFile').value=''};reader.readAsText(f)});
$('routeAll').addEventListener('click',function(){
  var p=S.stops.filter(function(s){return !s.done&&s.addr});
  if(!p.length){say('آدرسی برای مسیریابی ثبت نشده است.');return}
  var u='https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(p[p.length-1].addr);
  if(p.length>1)u+='&waypoints='+encodeURIComponent(p.slice(0,-1).map(function(s){return s.addr}).join('|'));
  window.open(u,'_blank')});
var _p=process;process=function(raw){var t=norm(raw);
  if(/مقصد بعدی|بعدی کجا/.test(t)){var n=S.stops.filter(function(s){return !s.done})[0];say(n?'مقصد بعدی: '+n.name+(n.addr?'، '+n.addr:'')+'، '+fa(n.lit)+' لیتر '+n.fuel:'همه مقصدها تحویل شده‌اند. خسته نباشید!');return}
  if(/حذف آخرین|آخری رو حذف/.test(t)){if(!confirm('آخرین مقصد حذف شود؟'))return;var x=S.stops.pop();save();render();say(x?'مقصد '+x.name+' حذف شد.':'چیزی برای حذف نیست.');return}
  if(/گزارش/.test(t)){rep();return}
  if(/^(سلام|خسته نباشی)/.test(t)&&!/لیتر/.test(t)){say('سلام! بفرمایید، گوش می‌دهم.');return}
  _p(raw)};
$('mic').addEventListener('click',function(){if(on)say('سلام، گوش می‌دهم.')});
/* ---- safety, meter, Q&A ---- */
var DIS='\n— دستورالعمل شرکت و مقررات محلی مقدم است.';
var KB=[
[/آتش|حریق|اطفا|شعله/,'🔥 آتش‌سوزی:\n۱) پمپ را قطع و شیر اضطراری را ببندید؛ موتور خاموش.\n۲) همه را دور کنید و با ۱۲۵ تماس بگیرید.\n۳) فقط اگر آتش کوچک است و راه فرارتان باز است: کپسول پودر (ABC/BC) را از فاصله به پایه‌ی آتش بزنید و جاروکنان حرکت دهید.\n۴) هرگز آب نریزید.\n۵) اگر آتش بزرگ شد یا به مخزن رسید: دور شوید، حداقل ۵۰ متر (در آتش مخزن تا ۸۰۰ متر) و منتظر آتش‌نشانی بمانید.\n۶) اگر لباستان آتش گرفت: ندوید، روی زمین بغلتید.'],
[/نشت|ریخت|سرریز/,'💧 نشت: پمپ را قطع و شیرها را ببندید؛ موتور و هر جرقه‌ای را دور کنید؛ با ماسه یا جاذب نشت را محدود کنید؛ به فاضلاب نریزید؛ پشت به باد بایستید و بخار تنفس نکنید؛ اگر زیاد است ۱۲۵ و مسئول را خبر کنید.'],
[/ارت|استاتیک|اتصال زمین|بوندینگ/,'⚡ ارت: پیش از اتصال شیلنگ، کابل اتصال زمین تانکر را وصل کنید و آخر از همه باز کنید؛ موتور خاموش باشد؛ لباس نایلونی نپوشید.'],
[/چک ?لیست|قبل از تخلیه|قبل از شروع/,'✅ قبل از تخلیه:\n• نوع سوخت و برچسب مخزن با سفارش یکی باشد\n• محل از شعله و جرقه دور، سیگار ممنوع\n• ترمز دستی، موتور خاموش، گوه زیر چرخ\n• کپسول در دسترس\n• کابل ارت وصل\n• شیلنگ و اتصال‌ها بدون نشت\n• جای خالی مخزن مشتری را بسنجید\n• عدد میتر ورودی را ثبت کنید\n• گوشی را دور از دهانه‌ی مخزن نگه دارید'],
[/میتر|کنتور|شمارنده/,'میتر: عدد قبل از شروع (ورودی) و بعد از پایان (خروجی) را بخوانید؛ مقدار تحویل = خروجی − ورودی. بگویید «میتر ورودی ۱۲۳۴۵ خروجی ۱۲۸۴۵» یا دکمه‌ی «میتر» روی کارت را بزنید. اگر بیش از ۰٫۵٪ با سفارش فرق داشته باشد هشدار می‌دهد.'],
[/خستگی|خسته|خواب|استرس|آرام|عصبی|نگران/,'🧘 یک لحظه آرام: ۴ ثانیه دم از بینی، ۶ ثانیه بازدم؛ ۵ بار تکرار کنید و شانه‌ها را شل کنید. اگر خواب‌آلود هستید همین‌جا در جای امن توقف و استراحت کنید. هر ۲ ساعت رانندگی یک استراحت و آب فراموش نشود. کارتان سخت است؛ سلامت شما از ساعت تحویل مهم‌تر است.'],
[/ظرفیت|پر ?کردن|لبریز|مخزن مشتری/,'پر کردن: پیش از شروع جای خالی مخزن را بسنجید و بیش از حدود ۹۵٪ ظرفیت پر نکنید تا جا برای انبساط بماند؛ نزدیک پر شدن شیر را آهسته کنید و از مخزن دور نشوید.'],
[/دما|گرما|انبساط/,'گرما: حجم سوخت حدود ۰٫۱ تا ۰٫۱۲ درصد به‌ازای هر درجه سانتی‌گراد تغییر می‌کند. در هوای گرم مخزن را کامل پر نکنید و تانکر را در سایه نگه دارید.'],
[/اشتباه|مخلوط/,'سوخت اشتباه: فوراً پمپ را قطع کنید، به مشتری بگویید خودرو یا دستگاه را روشن نکند و مسئول شرکت را خبر کنید.'],
[/شماره اضطراری|اورژانس|تلفن اضطراری/,'☎ آتش‌نشانی ۱۲۵ ، اورژانس ۱۱۵ ، پلیس ۱۱۰ (ایران).'],
[/کمک|راهنما|چه کار/,'می‌توانید بپرسید یا بگویید: آتش‌سوزی، نشت، ارت، چک‌لیست، میتر، ظرفیت، گرما، سوخت اشتباه، خستگی.']];
function kb(t){for(var i=0;i<KB.length;i++)if(KB[i][0].test(t))return KB[i][1]+DIS;return null}
function show(a){$('ans').textContent=a;say(a.replace(DIS,''))}
function ask(q){var t=norm(q),a=kb(t);if(a)show(a);else say('پاسخی پیدا نکردم. بگویید «کمک» تا موضوع‌ها را بشنوید.')}
$('askb').addEventListener('click',function(){if($('ask').value.trim())ask($('ask').value)});
document.querySelectorAll('button[data-k]').forEach(function(b){b.addEventListener('click',function(){ask(b.dataset.k)})});
function pick(t){var p=S.stops.filter(function(s){return !s.done});return p.filter(function(s){return s.name.split(/\s+/).some(function(w){return w.length>2&&!/^(آقای|خانم|شرکت|جناب)$/.test(w)&&t.indexOf(w)>-1})})[0]||p[0]}
function meter(s,a,b){var act=b-a;if(!s||!(act>0)){say('عدد میتر معتبر نیست؛ خروجی باید بزرگ‌تر از ورودی باشد.');return}
  if(S.cap>0&&act>tankRemaining()){say('ثبت نشد؛ مقدار میتر از موجودی باقی‌مانده تانکر بیشتر است.');return}
  s.ord=s.ord||s.lit;s.m=[a,b];s.lit=Math.round(act);s.done=true;save();render();
  var d=act-s.ord,bad=Math.abs(d)/s.ord>0.005;
  say('میتر ثبت شد: '+fa(s.lit)+' لیتر برای '+s.name+(bad?'. '+fa(Math.round(Math.abs(d)))+' لیتر '+(d>0?'بیشتر':'کمتر')+' از سفارش است.':'. مطابق سفارش است.'))}
var _r2=render;render=function(){_r2();
  document.querySelectorAll('#list article').forEach(function(a){var b=a.querySelector('button[data-t]');if(!b)return;
    var s=S.stops.filter(function(x){return x.id==b.dataset.t})[0];if(!s)return;
    var m=document.createElement('button');m.className='alt';m.textContent='میتر';m.dataset.m=s.id;b.parentNode.insertBefore(m,b.nextSibling);
    if(s.m){var g=document.createElement('span');g.className='tag';g.textContent='میتر '+fa(s.m[0])+' ← '+fa(s.m[1]);a.querySelector('div').appendChild(g)}})};
$('list').addEventListener('click',function(e){var t=e.target.closest('button[data-m]');if(!t)return;
  var s=S.stops.filter(function(x){return x.id==t.dataset.m})[0];
  var a=numberValue(prompt('عدد میتر ورودی (قبل از تخلیه):')||''),b=numberValue(prompt('عدد میتر خروجی (بعد از تخلیه):')||'');
  if(!isNaN(a)&&!isNaN(b))meter(s,a,b)});
var _p2=process;process=function(raw){var t=norm(raw);
  var im=t.match(/(?:ورودی|شروع)\D*?(\d+(?:\.\d+)?)/),om=t.match(/(?:خروجی|پایان)\D*?(\d+(?:\.\d+)?)/);
  if(/میتر|کنتور/.test(t)&&im&&om){var s=pick(t);if(!s){say('مقصدی در انتظار نیست.');return}meter(s,+im[1],+om[1]);return}
  var fl=/بنزین|گازوئیل|نفت/.test(t)&&/\d/.test(t);
  if(!fl&&!/تحویل|باقی|مانده|مقصد بعدی|حذف|گزارش/.test(t)){var a=kb(t);if(a){show(a);return}}
  _p2(raw)};
/* ---- chime & reminders ---- */
var AC,played=false;
function chime(n){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();var t=AC.currentTime;
  (n||[523,659,784,1047]).forEach(function(f,i){var o=AC.createOscillator(),g=AC.createGain(),s=t+i*.2;o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.25,s+.03);g.gain.exponentialRampToValueAtTime(.001,s+.8);
    o.connect(g);g.connect(AC.destination);o.start(s);o.stop(s+.85)})}catch(e){}}
chime();played=!!AC&&AC.state==='running';
if(!played){try{AC.close()}catch(e){}AC=null}
document.addEventListener('pointerdown',function(){if(AC&&AC.state==='suspended')AC.resume();if(!played){played=true;chime()}},{once:true});
var _sv=save;save=function(){S.act=Date.now();_sv()};
S.rem=S.rem||{iv:60,t:['','','']};var lastRem=Date.now(),firedKey='',nrem=0;
$('riv').value=S.rem.iv;
$('riv').addEventListener('change',function(){S.rem.iv=+this.value;lastRem=Date.now();_sv()});
['t1','t2','t3'].forEach(function(id,i){$(id).value=S.rem.t[i]||'';$(id).addEventListener('change',function(){S.rem.t[i]=this.value;_sv()})});
var wl=null;function lock(){try{navigator.wakeLock.request('screen').then(function(l){wl=l}).catch(function(){})}catch(e){}}
$('wl').addEventListener('change',function(){if(this.checked)lock();else if(wl){wl.release();wl=null}});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&$('wl').checked)lock()});
function remMsg(){var p=S.stops.filter(function(s){return !s.done}),dn=S.stops.filter(function(s){return s.done&&!s.m&&!s.q}).length,m=[];
  if(!S.stops.length)m.push('هنوز مقصدی ثبت نکرده‌اید. سفارش‌های امروز را ثبت کنید.');
  else if(p.length)m.push(fa(p.length)+' مقصد در انتظار است. بعدی: '+p[0].name+'.');
  else m.push('همه مقصدها تحویل شده‌اند. گزارش پایان روز را بفرستید.');
  if(dn)m.push('میتر '+fa(dn)+' تحویل را ثبت نکرده‌اید.');
  var h=(Date.now()-(S.act||0))/36e5;if(S.act&&h>=1.5)m.push('حدود '+fa(Math.round(h))+' ساعت است چیزی ثبت نکرده‌اید.');
  if(++nrem%2===0)m.push('کمی آب بنوشید و استراحت کنید.');
  return m.join(' ')}
function fire(){var m=remMsg();$('rtext').textContent=m;$('remind').hidden=false;chime([880,660,880,660]);
  try{navigator.vibrate([200,100,200])}catch(e){}setTimeout(function(){say(m)},1200)}
$('rok').addEventListener('click',function(){$('remind').hidden=true});
$('rtest').addEventListener('click',fire);
setInterval(function(){var n=new Date(),hm=('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2),k=n.toDateString()+hm;
  if(S.rem.t.indexOf(hm)>-1&&firedKey!==k){firedKey=k;lastRem=Date.now();fire();return}
  if(S.rem.iv&&Date.now()-lastRem>=S.rem.iv*6e4){lastRem=Date.now();fire()}},15000);
/* ---- fuels, points, celebration ---- */
function fuelName(t){return /سوپر|ممتاز/.test(t)?'بنزین سوپر':/نفت.?گاز|گازوئیل/.test(t)?'گازوئیل':/نفت/.test(t)?'نفت سفید':'بنزین معمولی'}
S.stops.forEach(function(s){if(s.fuel==='بنزین')s.fuel='بنزین معمولی'});
var FC={'بنزین معمولی':'#e0a526','بنزین سوپر':'#d1483a','نفت سفید':'#4aa3df','گازوئیل':'#3d9970'};
var LV=[[0,'🥉 برنزی'],[60,'🥈 نقره‌ای'],[150,'🥇 طلایی'],[300,'💎 الماسی']];
function lv(p){var i=0;LV.forEach(function(l,k){if(p>=l[0])i=k});return i}
var PR=['دمت گرم! یک تحویل دیگر.','عالی بود، ادامه بده.','یک مقصد دیگر تمام شد.','از شما ممنونیم، خسته نباشید.'];
function confetti(){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;var cs=['#e4c07a','#b88a2e','#f3d68f','#ffffff','#4aa3df'];
  for(var i=0;i<28;i++){(function(i){var d=document.createElement('i');d.style.cssText='position:fixed;top:-12px;left:'+Math.random()*100+'vw;width:8px;height:14px;border-radius:2px;z-index:99;pointer-events:none;background:'+cs[i%5];document.body.appendChild(d);
    d.animate([{transform:'translateY(0) rotate(0deg)',opacity:1},{transform:'translateY('+(innerHeight+40)+'px) rotate('+Math.round(Math.random()*720-360)+'deg)',opacity:.9}],{duration:1400+Math.random()*1200,easing:'ease-in'}).onfinish=function(){d.remove()}})(i)}}
var boot=true;S.pts=S.pts||0;S.doneIds=S.doneIds||[];S.streak=S.streak||0;
var _r3=render;render=function(){_r3();
  var gain=0,nq=0,old=lv(S.pts);
  S.stops.forEach(function(s){if(s.done&&S.doneIds.indexOf(s.id)<0){S.doneIds.push(s.id);gain+=pt(s);if(!s.q)nq++}});
  if(gain){S.pts+=gain;var td=new Date().toDateString(),y=new Date(Date.now()-864e5).toDateString();
    if(S.last!==td){S.streak=S.last===y?S.streak+1:1;S.last=td}_sv();
    if(!boot&&(nq||lv(S.pts)>old)){chime([659,784,988,1319]);confetti();var up=lv(S.pts)>old;
      say(up?'تبریک! به سطح '+LV[lv(S.pts)][1].slice(3)+' رسیدید.':PR[Math.floor(Math.random()*PR.length)]+' '+fa(gain)+' امتیاز.')}}
  boot=false;
  var i=lv(S.pts),nx=LV[i+1],pct=nx?(S.pts-LV[i][0])/(nx[0]-LV[i][0])*100:100,dn=S.stops.filter(function(s){return s.done}).length,r=S.stops.length?dn/S.stops.length:0;
  $('lvl').textContent='سطح '+LV[i][1];$('pts').textContent=fa(S.pts);$('lb').style.width=pct+'%';
  $('stk').textContent='⭐ '+fa(S.streak)+' روز متوالی';$('dcount').textContent='تحویل امروز: '+fa(dn);
  $('mot').textContent=!S.stops.length?'امروز را با اولین سفارش شروع کنید.':r>=1?'عالی بود! امروز را کامل تمام کردید.':r>=.5?'بیش از نیمی از کار انجام شد، ادامه بدهید.':'هر تحویل یک قدم نزدیک‌تر به سطح بعدی است.';
  document.querySelectorAll('#list article').forEach(function(a){var b=a.querySelector('button[data-t]');if(!b)return;
    var s=S.stops.filter(function(x){return x.id==b.dataset.t})[0],g=a.querySelector('.tag');if(s&&g)g.style.borderInlineStart='5px solid '+(FC[s.fuel]||'var(--gold)')})};
/* ---- welcome ---- */
var sp=$('splash');sp.querySelector('img').src=document.querySelector('.brand img').src;$('nm').value=S.name||'';played=true;
function greet(){var h=new Date().getHours();return h<5?'شب بخیر':h<12?'صبح بخیر':h<17?'ظهر بخیر':h<20?'عصر بخیر':'شب بخیر'}
$('sg').textContent=greet()+'، به پتروگاز پارس کیهان خوش آمدید';
$('go').addEventListener('click',function(){S.name=$('nm').value.trim();_sv();
  var p=S.stops.filter(function(s){return !s.done}).length,m=greet()+'، '+(S.name||'راننده')+' عزیز. به پتروگاز پارس کیهان خوش آمدید. '+(p?'امروز '+fa(p)+' مقصد در انتظار دارید. ':'آماده‌ی ثبت اولین خودرو هستید. ')+'روز پرانرژی و رانندگی امن برایتان آرزو می‌کنم.';
  sp.classList.add('out');setTimeout(function(){sp.hidden=true},500);
  chime([392,523,659,784,1047]);try{navigator.vibrate([80,60,80])}catch(e){}
  setTimeout(function(){say(m)},900);render()});
/* ---- station mode: quick car log ---- */
S.qf=S.qf||'بنزین معمولی';S.loc=S.loc||'';
$('loc').value=S.loc;$('loc').addEventListener('change',function(){S.loc=this.value.trim();_sv()});
function pt(s){return s.q?2+Math.floor(s.lit/50):10+Math.floor(s.lit/100)}
function pd(s){return String(s).replace(/\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[d]})}
var manual=false;
function qadd(f,l,x){x=x||{};if(!(Number.isFinite(l)&&l>0&&l<=1000)){say('مقدار سوخت باید بین ۱ تا ۱۰۰۰ لیتر باشد.');return false}
  if(!(S.cap>0)){say('ابتدا بار تانکر را در بخش وضعیت بار ثبت کنید تا فروش از موجودی نامشخص انجام نشود.');return false}
  if(l+pendingLiters()>tankRemaining()){say('ثبت نشد؛ با احتساب سفارش‌های باز، موجودی تانکر برای این مقدار کافی نیست.');return false}
  var plateInfo=normalizePlate(x.plate||''),td=new Date().toDateString();if(!plateInfo.valid){say('قالب پلاک معتبر نیست؛ نمونه: ۱۲ ب ۳۴۵ ایران ۶۷.');return false}
  if(plateInfo.key&&S.stops.some(function(z){return z.q&&z.day===td&&normalizePlate(z.plate||'').key===plateInfo.key})){say('این پلاک امروز قبلاً ثبت شده است.');return false}
  if(S.qd!==td){S.qd=td;S.qn=0}S.qn=(S.qn||0)+1;
  var unitPrice=Number(S.price[f]||0),manualAmount=x.amt!=null,amt=manualAmount?Number(x.amt):(unitPrice>0?l*unitPrice:null);
  if(manualAmount&&(!Number.isFinite(amt)||amt<0)){say('مبلغ دریافتی نامعتبر است.');return false}
  S.stops.push({id:Date.now()*10+Math.floor(Math.random()*10),name:'خودرو '+fa(S.qn),addr:S.loc,phone:'',fuel:f,lit:l,done:true,q:true,plate:plateInfo.value,car:x.car||'',amt:amt,unitPrice:unitPrice>0?unitPrice:null,priceLocked:true,amtManual:manualAmount,day:td});
  save();render();chime([880,1175]);
  say('ثبت شد: '+(x.car?x.car+'، ':'')+f.replace('بنزین ','')+' '+fa(l)+' لیتر'+(amt!=null?'، '+fa(amt)+' تومان'+(manualAmount?' (مبلغ دستی)':''):'، مبلغ نامشخص؛ قیمت هر لیتر را تنظیم کنید'));return true}
function qdel(id){for(var i=S.stops.length-1;i>=0;i--)if(S.stops[i].id==id){var s=S.stops.splice(i,1)[0],k=S.doneIds.indexOf(s.id);if(k>-1){S.doneIds.splice(k,1);S.pts=Math.max(0,S.pts-pt(s))}save();render();return true}return false}
function qundo(){for(var i=S.stops.length-1;i>=0;i--)if(S.stops[i].q){if(!confirm('آخرین ثبت خودرو حذف شود؟ این عملیات مبلغ و حجم ثبت‌شده را از گزارش محلی کم می‌کند.'))return;qdel(S.stops[i].id);say('آخرین خودرو برگردانده شد.');return}say('خودرویی برای برگرداندن نیست.')}
$('qf').addEventListener('click',function(e){var b=e.target.closest('button[data-f]');if(!b)return;S.qf=b.dataset.f;manual=false;_sv();qcalc();render()});
function qcalc(){if(manual)return;var l=numberValue($('qlit').value),p=Number(S.price[S.qf]||0);$('qamt').value=(l>0&&p)?l*p:''}
$('ql').addEventListener('click',function(e){var b=e.target.closest('button[data-l]');if(!b)return;var l=+b.dataset.l;if(!l){$('qlit').focus();return}$('qlit').value=l;manual=false;qcalc();render()});
$('qlit').addEventListener('input',function(){manual=false;qcalc()});
$('qamt').addEventListener('input',function(){manual=true});
$('qadd').addEventListener('click',function(){var l=numberValue($('qlit').value),plate=normalizePlate($('qplate').value.trim()),car=$('qcar').value.trim();
  if(!(Number.isFinite(l)&&l>0)){say('مقدار لیتر را وارد کنید.');return}
  if(!plate.valid){say('قالب پلاک معتبر نیست؛ نمونه: ۱۲ ب ۳۴۵ ایران ۶۷.');return}
  if(!plate.value&&!confirm('پلاک وارد نشده است. بدون پلاک ثبت شود؟'))return;
  var rawAmount=$('qamt').value.trim(),a=manual&&rawAmount!==''?numberValue(rawAmount):null;
  if(manual&&rawAmount!==''&&(!Number.isFinite(a)||a<0)){say('مبلغ دریافتی باید عددی مثبت یا صفر باشد.');return}
  if(qadd(S.qf,l,{plate:plate.value,car:car,amt:a})){['qplate','qcar','qlit','qamt'].forEach(function(id){$(id).value=''});manual=false;$('qplate').focus()}});
$('qundo').addEventListener('click',qundo);
$('qlog').addEventListener('click',function(e){var b=e.target.closest('button[data-x]');if(b&&confirm('این خودرو حذف شود؟'))qdel(b.dataset.x)});
var _r4=render;render=function(){_r4();
  document.querySelectorAll('#list article').forEach(function(a){var b=a.querySelector('button[data-t]');if(!b)return;var s=S.stops.filter(function(x){return x.id==b.dataset.t})[0];if(s&&s.q)a.remove()});
  document.querySelectorAll('#qf button').forEach(function(b){b.classList.toggle('sel',b.dataset.f===S.qf)});
  var d=S.stops.filter(function(s){return s.done}),by={};d.forEach(function(s){by[s.fuel]=(by[s.fuel]||0)+s.lit});
  var pr=Object.keys(by).map(function(k){return k.replace('بنزین ','')+': '+fa(by[k])+' لیتر'});
  $('qs').textContent=d.length?'امروز '+fa(d.length)+' تحویل — '+pr.join('، '):'سوخت را انتخاب کنید و مقدار هر خودرو را بزنید.'};
var _rep=rep;$('report').removeEventListener('click',_rep);
rep=function(){var d=S.stops.filter(function(s){return s.done}),q=d.filter(function(s){return s.q}),o=d.filter(function(s){return !s.q}),L=0,R=0,by={};
  var tx='گزارش تحویل سوخت — '+new Date().toLocaleDateString('fa-IR')+'\n'+(S.loc?'محل: '+S.loc+'\n':'')+(S.name?'راننده: '+S.name+'\n':'');
  q.forEach(function(s){var b=by[s.fuel]=by[s.fuel]||{n:0,l:0,a:0,u:0};b.n++;b.l+=s.lit;if(hasAmount(s))b.a+=amtOf(s);else b.u++;tx+='• '+(s.plate?pd(s.plate):'بدون پلاک')+' | '+(s.car||'—')+' | '+s.fuel.replace('بنزین ','')+' '+fa(s.lit)+' لیتر | '+amtLabel(s)+(s.amtManual?' (دستی)':'')+'\n'});
  if(q.length)tx+='— خلاصه —\n';
  Object.keys(by).forEach(function(k){tx+=k+': '+fa(by[k].n)+' خودرو، '+fa(by[k].l)+' لیتر، '+fa(by[k].a)+' تومان'+(by[k].u?'، مبلغ '+fa(by[k].u)+' خودرو نامشخص':'')+'\n'});
  o.forEach(function(s){tx+='• '+s.name+' — '+s.fuel+' '+fa(s.lit)+' لیتر\n'});
  var unknownAmounts=0;d.forEach(function(s){L+=s.lit;if(hasAmount(s))R+=amtOf(s);else unknownAmounts++});
  tx+='جمع: '+fa(d.length)+' تحویل، '+fa(L)+' لیتر | مبالغ ثبت‌شده: '+fa(R)+' تومان';
  if(unknownAmounts)tx+=' | مبلغ '+fa(unknownAmounts)+' خودرو نامشخص است';
  tx+='\nباقی‌مانده تانکر: '+fa(Math.max(S.cap-L,0))+' لیتر';
  if(navigator.share){navigator.share({text:tx}).catch(function(){})}
  else{try{navigator.clipboard.writeText(tx);say('گزارش کپی شد. در پیام‌رسان بچسبانید.')}catch(e){say('ارسال گزارش در این مرورگر ممکن نیست.')}}};
$('report').addEventListener('click',rep);
var _p3=process;process=function(raw){var t=norm(raw),fl=/بنزین|سوپر|معمولی|گازوئیل|نفت/.test(t),m=t.match(/(\d{1,4})/);
  if(/^(برگردان|حذف) ?(آخرین )?خودرو/.test(t)||/آخرین خودرو.*(حذف|برگردان)/.test(t)){qundo();return}
  if(fl&&m&&!/برای|مشتری|آدرس|تلفن|میتر|کنتور|بار|تانکر/.test(t)){if(vq(t))return}
  _p3(raw)};
/* ---- car log extras ---- */
var CARS=['پژو ۲۰۶','پژو ۲۰۷','پژو ۴۰۵','پژو پارس','سمند','دنا','تارا','رانا','تیبا','ساینا','کوییک','پراید','شاهین','تندر ۹۰','هایما','کیا','هیوندای','تویوتا','مزدا','وانت','موتور'];
function vq(t){var pm=t.match(/(\d{2})\s*([آ-ی])\s*(\d{3})\s*(?:ایران)?\s*(\d{2})/),plate='',r=t;
  if(pm){plate=pm[1]+' '+pm[2]+' '+pm[3]+' ایران '+pm[4];r=t.replace(pm[0],' ')}
  var am=r.match(/(?:مبلغ|هزینه|دریافت\S*)\D*?(\d+)/),amt=null;if(am){amt=+am[1];r=r.replace(am[0],' ')}
  var lm=r.match(/(\d{1,3})\s*لیتر/)||r.match(/(?:^|\s)(\d{1,3})(?=\s|$)/);if(!lm)return false;
  var car='';CARS.forEach(function(c){if(!car&&t.indexOf(norm(c))>-1)car=c});
  qadd(fuelName(t),+lm[1],{plate:plate,car:car,amt:amt});return true}
function esc2(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
var _r5=render;render=function(){_r5();
  var qs=S.stops.filter(function(s){return s.q}).reverse();
  $('qlog').innerHTML=qs.length?qs.map(function(s){return '<div class="qr"><span>'+(s.plate?pd(esc2(s.plate)):'بدون پلاک')+' | '+esc2(s.car||'—')+' | '+s.fuel.replace('بنزین ','')+' '+fa(s.lit)+' لیتر | '+amtLabel(s)+(s.amtManual?' • دستی':'')+'</span><button class="del" data-x="'+s.id+'" aria-label="حذف">×</button></div>'}).join(''):'<div class="empty">هنوز خودرویی ثبت نشده.</div>';
  document.querySelectorAll('#ql button[data-l]').forEach(function(b){b.classList.toggle('sel',b.dataset.l===$('qlit').value)});
  qcalc()};
render();
})();
