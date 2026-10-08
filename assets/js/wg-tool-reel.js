/* Tool reel: row arrows and tap-to-play clips. A clip loads only on the first tap, one plays at a time. */
(function(){
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function rowState(){document.querySelectorAll('.ts-rowwrap').forEach(function(w){var r=w.querySelector('.ts-row'),p=w.querySelector('.prev'),n=w.querySelector('.next');if(!r.clientWidth)return;p.hidden=r.scrollLeft<8;n.hidden=r.scrollLeft+r.clientWidth>=r.scrollWidth-8})}
document.querySelectorAll('.ts-rowwrap').forEach(function(w){
 var r=w.querySelector('.ts-row');
 r.addEventListener('scroll',rowState,{passive:true});
 w.addEventListener('click',function(e){var a=e.target.closest('.ts-arrow');if(!a)return;var step=r.querySelector('li').offsetWidth+14;r.scrollBy({left:(a.classList.contains('next')?1:-1)*step*2,behavior:reduce?'auto':'smooth'})});
});
function stopAll(except){document.querySelectorAll('.vph video').forEach(function(o){if(o!==except){o.pause();o.closest('.vph').classList.remove('is-playing')}})}
document.querySelectorAll('.vph').forEach(function(box){
 box.addEventListener('click',function(){
  var v=box.querySelector('video');
  if(!v){stopAll();
   v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('playsinline','');v.loop=!reduce;v.preload='auto';v.setAttribute('aria-hidden','true');v.src=box.dataset.vid;
   box.insertBefore(v,box.querySelector('.vplay'));
   v.addEventListener('ended',function(){box.classList.remove('is-playing')});}
  if(v.paused){stopAll(v);v.play().then(function(){box.classList.add('is-playing')}).catch(function(){})}
  else{v.pause();box.classList.remove('is-playing')}
 });
});
addEventListener('resize',rowState);
addEventListener('load',rowState);
rowState();
})();
