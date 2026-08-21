/* Nexus Spaceports — shared behaviour for index.html and news/index.html.
   Every block guards on the elements it needs, so it is safe on either page.
   The globe, its coastline data and the locator map stay inline on the home
   page: they are specific to it and the payload is large. */
/* nav */
(function(){
  var nav=document.getElementById('nav'),b=document.getElementById('burger'),d=document.getElementById('drawer');
  addEventListener('scroll',function(){nav.classList.toggle('solid',scrollY>40)},{passive:true});
  b.addEventListener('click',function(){b.classList.toggle('open');d.classList.toggle('open')});
  d.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){b.classList.remove('open');d.classList.remove('open')})});
})();
/* theme toggle - persists the choice, defaults to the OS preference */
(function(){
  var root=document.documentElement,btn=document.getElementById('themetog');
  if(!btn)return;
  function apply(t,save){
    root.setAttribute('data-theme',t);
    var light=t==='light';
    btn.setAttribute('aria-pressed',light?'true':'false');
    btn.setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');
    btn.querySelector('.tt-lab').textContent=light?'Dark':'Light';
    var m=document.querySelector('meta[name="theme-color"]');
    if(m)m.setAttribute('content',light?'#eef4f9':'#04151c');
    if(save){try{localStorage.setItem('nx-theme',t)}catch(e){}}
    try{window.dispatchEvent(new CustomEvent('nx-theme',{detail:t}))}catch(e){}
  }
  apply(root.getAttribute('data-theme')==='light'?'light':'dark',false);
  btn.addEventListener('click',function(){
    apply(root.getAttribute('data-theme')==='light'?'dark':'light',true);
  });
})();
/* Contact links resolve on first interaction. Until then the markup stands as
   served; without JS it falls back to the enquiry form, a working route. */
(function(){
  var n=document.querySelectorAll('[data-m]');if(!n.length)return;
  var ev=['pointerdown','pointermove','mousedown','mousemove','touchstart','keydown','wheel','scroll'];
  var done=false;

  function resolve(){
    if(done)return;done=true;
    for(var j=0;j<ev.length;j++)window.removeEventListener(ev[j],resolve,true);
    var a=['info',String.fromCharCode(64),'nexus-spaceport','.','com'].join('');
    for(var i=0;i<n.length;i++){
      n[i].setAttribute('href','mai'+'lto'+':'+a);
      /* The CSS-generated @ and . render correctly but are not picked up when a
         visitor copies the selection, so the split spans become real text. */
      n[i].textContent=a;
      n[i].classList.remove('eml');
    }
  }
  /* Capture phase, so a link activated by the very first click is already
     resolved by the time its default action runs. */
  for(var k=0;k<ev.length;k++)
    window.addEventListener(ev[k],resolve,{capture:true,passive:true});
})();
/* reveal on scroll, with staggered grid children */
(function(){
  var each=function(l,f){Array.prototype.forEach.call(l,f)};
  each(document.querySelectorAll('.g2,.g3,.g4,.why,.sites'),function(g){
    g.classList.add('stag');
    each(g.children,function(c,i){c.style.setProperty('--d',(i*55)+'ms')});
  });
  var els=document.querySelectorAll('.rv,.stag');
  if(!('IntersectionObserver' in window)){each(els,function(e){e.classList.add('in')});return}
  var io=new IntersectionObserver(function(en){en.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}
  })},{rootMargin:'0px 0px -8% 0px',threshold:.06});
  each(els,function(e){io.observe(e)});
})();
/* ── enquiry form ───────────────────────────────────────────────────────────
   To deliver enquiries to an inbox, create a free form at https://formspree.io
   (or Netlify Forms / Basin) and paste its endpoint URL into ENDPOINT below.
   Nothing else needs to change.

   Until ENDPOINT is set the form tells the visitor plainly that nothing was
   sent rather than pretending otherwise.
   ─────────────────────────────────────────────────────────────────────────── */
(function(){
  var ENDPOINT = '';                          /* e.g. 'https://formspree.io/f/abcdwxyz' */

  var f=document.getElementById('enq');if(!f)return;
  var msg=document.getElementById('msg'),sub=document.getElementById('sub');

  function setMsg(kind,html){msg.className='msg show '+kind;msg.innerHTML=html}
  function clearMsg(){msg.className='msg';msg.innerHTML=''}

  function mark(id,text){
    var el=document.getElementById(id),e=document.getElementById('e-'+id);
    if(text){el.classList.add('bad');e.textContent=text;e.classList.add('show')}
    else{el.classList.remove('bad');e.textContent='';e.classList.remove('show')}
    return !text;
  }
  function validate(){
    var em=f.em.value.trim(),ok=true;
    ok=mark('fn',f.fn.value.trim()?'':'Required')&&ok;
    ok=mark('ln',f.ln.value.trim()?'':'Required')&&ok;
    ok=mark('em',!em?'Required':(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)?'':'Enter a valid email address'))&&ok;
    return ok;
  }
  ['fn','ln','em'].forEach(function(id){
    document.getElementById(id).addEventListener('input',function(){
      if(this.classList.contains('bad'))validate();
    });
  });

  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    clearMsg();
    if(!validate()){
      setMsg('bad','Please correct the highlighted fields.');
      f.querySelector('.bad').focus();
      return;
    }
    var d={
      firstName:f.fn.value.trim(),lastName:f.ln.value.trim(),
      organisation:f.org.value.trim(),email:f.em.value.trim(),
      investorType:f.ty.value,message:f.ms.value.trim()
    };

    if(!ENDPOINT){
      setMsg('bad','Enquiries are not being accepted on this preview build, so your message has '+
             '<strong>not</strong> been sent. Please try again once the site is live.');
      return;
    }

    sub.disabled=true;sub.textContent='Sending…';
    fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(d)
    }).then(function(r){
      if(!r.ok)throw new Error(r.status);
      setMsg('good','Enquiry received. A member of the team will be in touch shortly.');
      f.reset();
    }).catch(function(){
      setMsg('bad','Something went wrong and your enquiry was <strong>not</strong> submitted. '+
             'Please try again in a moment.');
    }).then(function(){
      sub.disabled=false;sub.textContent='Submit enquiry →';
    });
  });
})();


/* ── news ────────────────────────────────────────────────────────────────────
   One renderer serves both the strip on the home page and the list on the news
   page. Each reads news/data/index.json, built by tools/build-news.js.
   ──────────────────────────────────────────────────────────────────────────── */
(function(){
  var strip=document.getElementById('news-strip');
  var list=document.getElementById('news-list');
  var article=document.getElementById('news-article');
  if(!strip && !list && !article) return;

  var host=(strip||list||article);
  var SRC=host.getAttribute('data-src');
  var BASE=host.getAttribute('data-base')||'';

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function postUrl(slug){ return BASE+'news/?post='+encodeURIComponent(slug); }

  function card(p,cls){
    var img=p.image
      ? '<div class="ns-img"><img src="'+BASE+esc(p.image)+'" alt="'+esc(p.imageAlt||p.title)+'" loading="lazy" decoding="async"></div>'
      : '';
    return '<a class="'+cls+(p.image?'':' noimg')+'" href="'+postUrl(p.slug)+'">'+img+
      '<div class="ns-body"><div class="ns-date">'+esc(p.dateLabel)+'</div>'+
      '<div class="ns-title">'+esc(p.title)+'</div>'+
      '<p class="ns-excerpt">'+esc(p.summary)+'</p>'+
      '<span class="ns-more">Read more &rsaquo;</span></div></a>';
  }

  fetch(SRC,{cache:'no-cache'}).then(function(r){
    if(!r.ok) throw new Error(r.status); return r.json();
  }).then(function(posts){

    /* ---- home page strip ---- */
    if(strip){
      var recent=posts.slice(0,5);
      var rail=strip.querySelector('.ns-track');
      var prev=strip.querySelector('.ns-prev'), next=strip.querySelector('.ns-next');
      if(!recent.length){ strip.querySelector('.ns-viewport').innerHTML='<p class="ns-empty">No news yet.</p>'; return; }
      rail.innerHTML=recent.map(function(p){ return card(p,'ns-card'); }).join('');
      var cards=[].slice.call(rail.children), idx=0, hoverTimer=null;

      function layout(){
        var vw=rail.parentNode.clientWidth;
        if(!vw||!cards.length) return;
        var cw=cards[0].getBoundingClientRect().width;
        var gap=parseFloat(getComputedStyle(rail).gap)||0;
        var offset=(vw-cw)/2;
        rail.style.transform='translateX('+(offset-idx*(cw+gap))+'px)';
        cards.forEach(function(c,i){ c.classList.toggle('dim', i!==idx); });
        if(prev) prev.disabled = idx===0;
        if(next) next.disabled = idx===cards.length-1;
      }
      function go(i){ idx=Math.max(0,Math.min(cards.length-1,i)); layout(); }

      cards.forEach(function(c,i){
        /* hovering a neighbour slides it in - short delay so passing the mouse
           across the strip does not fire a cascade of transitions */
        c.addEventListener('mouseenter',function(){
          if(i===idx) return;
          clearTimeout(hoverTimer);
          hoverTimer=setTimeout(function(){ go(i); },160);
        });
        c.addEventListener('mouseleave',function(){ clearTimeout(hoverTimer); });
      });
      if(prev) prev.addEventListener('click',function(){ go(idx-1); });
      if(next) next.addEventListener('click',function(){ go(idx+1); });
      window.addEventListener('resize',function(){ clearTimeout(hoverTimer); layout(); });
      layout();
      /* re-measure once webfonts land, since card height can shift */
      if(document.fonts&&document.fonts.ready) document.fonts.ready.then(layout).catch(function(){});
    }

    /* ---- news page: list ---- */
    if(list){
      if(!posts.length){ list.innerHTML='<p class="ns-empty">No news yet.</p>'; return; }
      list.innerHTML=posts.map(function(p){ return card(p,'nx-item'); }).join('')
        .replace(/class="ns-img"/g,'class="nx-thumb"');
    }

    /* ---- news page: single article ---- */
    if(article){
      var slug=new URLSearchParams(location.search).get('post');
      if(!slug) return;
      var p=posts.filter(function(x){ return x.slug===slug; })[0];
      if(!p){ article.innerHTML='<p class="ns-empty">That post could not be found.</p>'; article.hidden=false; return; }
      if(list) list.hidden=true;
      var listHead=document.getElementById('news-list-head');
      if(listHead) listHead.hidden=true;
      document.title=p.title+' — Nexus Spaceports';
      fetch(BASE+'news/data/'+encodeURIComponent(slug)+'.html',{cache:'no-cache'})
        .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
        .then(function(html){
          article.innerHTML=
            '<a class="nx-back" href="'+BASE+'news/">&lsaquo; All news</a>'+
            '<div class="ns-date">'+esc(p.dateLabel)+'</div>'+
            '<h1 style="font-size:clamp(30px,4.4vw,56px);margin-bottom:8px">'+esc(p.title)+'</h1>'+
            (p.image?'<figure class="nx-hero"><img src="'+BASE+esc(p.image)+'" alt="'+esc(p.imageAlt||p.title)+'"></figure>':'')+
            '<div class="nx-body">'+html+'</div>';
          article.hidden=false;
        }).catch(function(){
          article.innerHTML='<p class="ns-empty">That post could not be loaded.</p>';
          article.hidden=false;
        });
    }
  }).catch(function(){
    if(strip) strip.hidden=true;   /* only hide on failure - otherwise the space
                                      is reserved from the start, so nothing shifts */
    if(list) list.innerHTML='<p class="ns-empty">News could not be loaded.</p>';
  });
})();
