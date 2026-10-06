async (page) => {
  const SP='ux-audit/'; // output folder for screenshots (not kept in the repo)
  const fs = require('fs');
  const pages=['/','/s/93/','/s/101/'];
  const vps={phone:[390,844],wide:[1280,800]};
  const schemes=['light','dark'];
  const out=[];
  const fn = () => {
    const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
    const parse=(c)=>{cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=c;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;
      // handle alpha: fillRect over transparent canvas gives premultiplied -> getImageData unpremultiplied with alpha
      return [d[0],d[1],d[2],d[3]/255];};
    const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
    const over=(f,b)=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3]));
    const bgOf=(el)=>{let layers=[];let n=el;let hasImg=false;while(n&&n.nodeType===1){const cs=getComputedStyle(n);const c=parse(cs.backgroundColor);if(cs.backgroundImage&&cs.backgroundImage!=='none')hasImg=true;if(c[3]>0){layers.push(c);if(c[3]>=0.999)break;}n=n.parentElement;}
      let base=[255,255,255];const sch=getComputedStyle(document.documentElement).colorScheme;
      // root fallback: use canvas default from body if none opaque
      if(!(layers.length&&layers[layers.length-1][3]>=0.999)){base=matchMedia('(prefers-color-scheme: dark)').matches?[0,0,0]:[255,255,255];}
      let res=base;for(let i=layers.length-1;i>=0;i--){res=over(layers[i],res);}return {rgb:res,hasImg};};
    const vis=(el)=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&parseFloat(cs.opacity)>0;};
    const sel=(el)=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;const c=(typeof el.className==='string'?el.className:'').split(/\s+/).filter(Boolean).slice(0,2).join('.');if(c)s+='.'+c;return s;};
    const res={};
    const de=document.documentElement;
    res.lang=de.lang;res.dir=de.dir;res.dataTheme=de.dataset.theme;
    res.overflow={scrollW:de.scrollWidth,clientW:de.clientWidth,bodyScrollW:document.body.scrollWidth,overflowX:de.scrollWidth>de.clientWidth};
    const bcs=getComputedStyle(document.body);res.body={fontSize:bcs.fontSize,lineHeight:bcs.lineHeight,fontFamily:bcs.fontFamily.slice(0,60)};
    // font sizes of text elements
    const sizes={};const ps=[...document.querySelectorAll('p,li,span,a,button,h1,h2,h3,div')].filter(e=>vis(e)&&[...e.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()));
    ps.forEach(e=>{const fs=Math.round(parseFloat(getComputedStyle(e).fontSize));sizes[fs]=(sizes[fs]||0)+1;});res.fontSizeHistogram=sizes;
    const pEl=document.querySelector('main p, p');if(pEl){const c=getComputedStyle(pEl);res.firstParagraph={fontSize:c.fontSize,lineHeight:c.lineHeight};}
    // targets
    const tg=[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button],[role=tab],[role=link],[role=switch],[tabindex]:not([tabindex="-1"])')].filter(vis);
    const small=[];tg.forEach(e=>{const r=e.getBoundingClientRect();if(r.width<44||r.height<44){small.push({s:sel(e),t:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)});}});
    res.targets={total:tg.length,smallCount:small.length,small:small.slice(0,40)};
    // names
    const unnamed=[];tg.forEach(e=>{const n=(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.innerText||e.getAttribute('title')||e.getAttribute('alt')||'').toString().trim();const lab=e.labels&&e.labels.length;const imgalt=e.querySelector&&e.querySelector('img[alt]:not([alt=""]),svg title');if(!n&&!lab&&!imgalt)unnamed.push(sel(e));});
    res.unnamed={count:unnamed.length,list:unnamed.slice(0,20)};
    const imgs=[...document.querySelectorAll('img')];res.images={total:imgs.length,noAlt:imgs.filter(i=>!i.hasAttribute('alt')).length,emptyAlt:imgs.filter(i=>i.getAttribute('alt')==='').length};
    const svgs=[...document.querySelectorAll('svg')].filter(vis);res.svg={total:svgs.length,noAriaHiddenNoName:svgs.filter(s=>s.getAttribute('aria-hidden')!=='true'&&!s.getAttribute('aria-label')&&!s.querySelector('title')&&!s.closest('[aria-hidden=true]')).length};
    // contrast
    const rows=[];const seen=new Set();
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let tn;
    while(tn=walker.nextNode()){if(!tn.textContent.trim())continue;const el=tn.parentElement;if(!el||!vis(el)||seen.has(el))continue;seen.add(el);
      if(el.closest('script,style,noscript'))continue;
      const cs=getComputedStyle(el);const fg=parse(cs.color);const bg=bgOf(el);const fgc=over(fg,bg.rgb);
      const L1=lum(fgc),L2=lum(bg.rgb);const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const fsz=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight)>=700;const large=fsz>=24||(fsz>=18.66&&bold);
      rows.push({s:sel(el),t:tn.textContent.trim().slice(0,20),ratio:+ratio.toFixed(2),fsz,large,hasBgImg:bg.hasImg,fg:cs.color.slice(0,40)});}
    const fail=rows.filter(r=>r.ratio<(r.large?3:4.5));
    res.contrast={textElements:rows.length,belowThreshold:fail.length,withBgImageUncertain:rows.filter(r=>r.hasBgImg).length,worst5:rows.sort((a,b)=>a.ratio-b.ratio).slice(0,5)};
    return res;
  };
  for(const [vn,[w,h]] of Object.entries(vps)){
    for(const sc of schemes){
      await page.setViewportSize({width:w,height:h});
      await page.emulateMedia({colorScheme:sc});
      for(const p of pages){
        await page.goto('https://hudan.ahmedothman.online'+p,{waitUntil:'load'});
        await page.waitForTimeout(2000);
        const r=await page.evaluate(fn);
        r.page=p;r.vp=vn;r.scheme=sc;
        out.push(r);
        await page.screenshot({path:SP+`${vn}-${sc}-${p.replace(/\//g,'_')}.png`});
      }
    }
  }
  fs.writeFileSync(SP+'automated.json',JSON.stringify(out,null,1));
  return out.map(r=>({p:r.page,vp:r.vp,sc:r.scheme,ovf:r.overflow.overflowX,sw:r.overflow.scrollW,cw:r.overflow.clientW,small:r.targets.smallCount,tot:r.targets.total,unn:r.unnamed.count,imgs:JSON.stringify(r.images),svg:r.svg.noAriaHiddenNoName,cLow:r.contrast.belowThreshold,cN:r.contrast.textElements}));
}
