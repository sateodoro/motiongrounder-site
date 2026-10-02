function playTitleIntro() {
  var root = document.documentElement;
  var title = document.querySelector('.mg-title');
  if (!title || !root.classList.contains('mg-intro')) return;

  var flies = Array.prototype.slice.call(title.querySelectorAll('.mg-fly'));
  var steps = ['mg-intro-reveal', 'mg-intro-lit', 'mg-intro-fly', 'mg-intro-land'];
  var finish = function () {
    flies.forEach(function (fly) { fly.style.transform = ''; });
    steps.forEach(function (step) { title.classList.remove(step); });
    root.classList.remove('mg-intro');
  };

  try {
    flies.forEach(function (fly) {
      var box = fly.getBoundingClientRect();
      var text = fly.querySelector('.mg-fly-text').getBoundingClientRect();
      var src = title.querySelector('.mg-src-' + fly.dataset.word).getBoundingClientRect();
      var k = src.height / text.height;
      var dx = src.left - box.left - k * (text.left - box.left);
      var dy = src.top - box.top - k * (text.top - box.top);
      fly.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')';
    });

    setTimeout(function () { title.classList.add('mg-intro-reveal'); }, 100);
    setTimeout(function () { title.classList.add('mg-intro-lit'); }, 2250);
    setTimeout(function () {
      title.classList.add('mg-intro-fly');
      title.getBoundingClientRect();
      flies.forEach(function (fly) { fly.style.transform = ''; });
    }, 2900);
    setTimeout(function () {
      title.classList.remove('mg-intro-lit');
      title.classList.add('mg-intro-land');
    }, 4150);
    setTimeout(finish, 5050);
  } catch (e) {
    finish();
  }
}

function buildObjectBoxes(svg, colors) {
  svg.textContent = '';
  return colors.map(function (color, k) {
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'mg-box mg-box-' + color);
    rect.setAttribute('rx', 12);
    rect.dataset.obj = k + 1;
    svg.appendChild(rect);
    return rect;
  });
}

function placeObjectBoxes(rects, boxes, video, fps) {
  var frame = Math.min(boxes[0].length - 1, Math.floor(video.currentTime * fps + 0.001));
  rects.forEach(function (rect, k) {
    var b = boxes[k][frame];
    if (!b) { rect.style.display = 'none'; return; }
    rect.style.display = '';
    var x = Math.max(b[0], 3), y = Math.max(b[1], 3);
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', Math.min(b[0] + b[2], 717) - x);
    rect.setAttribute('height', Math.min(b[1] + b[3], 477) - y);
  });
}

function followVideo(video, ref) {
  if (!ref.duration || video.seeking || video.readyState < 2) return;
  var drift = Math.abs(video.currentTime - ref.currentTime);
  drift = Math.min(drift, ref.duration - drift);
  if (drift > 0.12) video.currentTime = ref.currentTime;
}

function bindObjectTags(container, scope) {
  ['mouseover', 'focusin'].forEach(function (type) {
    scope.addEventListener(type, function (event) {
      var tag = event.target.closest('.mg-tag');
      if (tag) container.dataset.hot = tag.dataset.obj;
    });
  });
  ['mouseout', 'focusout'].forEach(function (type) {
    scope.addEventListener(type, function () { delete container.dataset.hot; });
  });
}

function initApplications() {
  var apps = document.getElementById('mg-apps');
  var dataEl = document.getElementById('mg-teaser-data');
  if (!apps || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var ref = apps.querySelector('video[data-ref]');
  var reference = data.references[ref.dataset.ref];
  var others = Array.prototype.slice.call(apps.querySelectorAll('video:not([data-ref])'));
  var rects = buildObjectBoxes(apps.querySelector('.mg-boxes'), reference.colors);
  bindObjectTags(apps, apps);

  (function tick() {
    placeObjectBoxes(rects, reference.boxes, ref, data.fps);
    others.forEach(function (video) { followVideo(video, ref); });
    requestAnimationFrame(tick);
  })();
}

function initResultsCarousel() {
  var root = document.getElementById('mg-results');
  var dataEl = document.getElementById('mg-teaser-data');
  if (!root || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var track = root.querySelector('.mg-carousel-track');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.mg-slide'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.mg-dot'));
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.mg-tab'));
  var index = 0;
  var LOOPS = 4;
  var auto = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var held = false, visible = false, loops = 0, lastTime = 0;

  var groups = slides.map(function (slide) {
    var ref = slide.querySelector('video[data-ref]');
    var reference = data.references[ref.dataset.ref];
    bindObjectTags(slide, slide);
    return {
      ref: ref,
      videos: Array.prototype.slice.call(slide.querySelectorAll('video')),
      others: Array.prototype.slice.call(slide.querySelectorAll('video:not([data-ref])')),
      rects: buildObjectBoxes(slide.querySelector('.mg-boxes'), reference.colors),
      boxes: reference.boxes
    };
  });

  function load(i) {
    groups[i].videos.forEach(function (video) {
      if (video.dataset.src) {
        video.src = video.dataset.src;
        video.removeAttribute('data-src');
      }
    });
  }

  function place() {
    track.style.transform = 'translateX(' + (slides[0].offsetLeft - slides[index].offsetLeft) + 'px)';
  }

  function go(i) {
    index = (i + slides.length) % slides.length;
    loops = 0;
    lastTime = 0;
    load(index);
    slides.forEach(function (slide, k) {
      var active = k === index;
      slide.classList.toggle('is-active', active);
      slide.inert = !active;
      delete slide.dataset.hot;
      groups[k].videos.forEach(function (video) {
        if (!active) { video.pause(); return; }
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      });
      dots[k].classList.toggle('is-active', active);
      dots[k].style.removeProperty('--progress');
    });
    tabs.forEach(function (tab) {
      tab.classList.toggle('is-active', tab.dataset.group === slides[index].dataset.group);
    });
    place();
    setTimeout(function () { load((index + 1) % slides.length); }, 600);
  }

  root.addEventListener('click', function (event) {
    var jump = event.target.closest('[data-go]');
    var step = event.target.closest('[data-step]');
    if (jump) go(Number(jump.dataset.go));
    else if (step) go(index + Number(step.dataset.step));
  });
  root.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') go(index - 1);
    if (event.key === 'ArrowRight') go(index + 1);
  });

  var startX = null;
  track.addEventListener('touchstart', function (event) { startX = event.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', function (event) {
    if (startX === null) return;
    var dx = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  });
  window.addEventListener('resize', place);
  ['mouseenter', 'focusin'].forEach(function (type) {
    root.addEventListener(type, function () { held = true; });
  });
  ['mouseleave', 'focusout'].forEach(function (type) {
    root.addEventListener(type, function () { held = false; });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.3 }).observe(root);
  } else {
    visible = true;
  }

  go(0);
  (function tick() {
    var group = groups[index];
    placeObjectBoxes(group.rects, group.boxes, group.ref, data.fps);
    group.others.forEach(function (video) { followVideo(video, group.ref); });

    var time = group.ref.currentTime;
    if (auto && visible && !held && group.ref.duration) {
      if (time < lastTime - 0.5) loops += 1;
      dots[index].style.setProperty('--progress', Math.min((loops + time / group.ref.duration) / LOOPS, 1));
      if (loops >= LOOPS) go(index + 1);
    }
    lastTime = time;
    requestAnimationFrame(tick);
  })();
}

function initTeaserStage() {
  var stage = document.getElementById('mg-teaser');
  var dataEl = document.getElementById('mg-teaser-data');
  if (!stage || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var svg = stage.querySelector('.mg-boxes');
  var caption = stage.querySelector('.mg-stage-caption');
  var picks = Array.prototype.slice.call(stage.querySelectorAll('.mg-pick'));
  var refVideos = {}, genVideos = {};
  stage.querySelectorAll('video[data-ref]').forEach(function (v) { refVideos[v.dataset.ref] = v; });
  stage.querySelectorAll('video[data-example]').forEach(function (v) { genVideos[v.dataset.example] = v; });

  var DWELL = 4;
  var auto = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var held = false, elapsed = 0, last = null, index = -1, current = null, rects = [];

  function play(video) {
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function buildCaption(example, colors) {
    caption.textContent = '';
    caption.appendChild(document.createTextNode('\u201C'));
    example.caption.split(/(\{\d\})/).forEach(function (part) {
      var m = part.match(/^\{(\d)\}$/);
      if (!m) { caption.appendChild(document.createTextNode(part)); return; }
      var tag = document.createElement('span');
      tag.className = 'mg-tag mg-tag-' + colors[m[1] - 1];
      tag.dataset.obj = m[1];
      tag.tabIndex = 0;
      tag.textContent = example.words[m[1] - 1];
      caption.appendChild(tag);
    });
    caption.appendChild(document.createTextNode('\u201D'));
  }

  function show(i, byUser) {
    var example = data.examples[i];
    var reference = data.references[example.ref];
    var refChanged = !current || current.ref !== example.ref;
    var ref = refVideos[example.ref], gen = genVideos[example.id];

    Object.keys(genVideos).forEach(function (id) {
      genVideos[id].classList.toggle('is-active', id === example.id);
      if (id !== example.id) genVideos[id].pause();
    });
    if (refChanged) {
      Object.keys(refVideos).forEach(function (name) {
        refVideos[name].classList.toggle('is-active', name === example.ref);
        if (name !== example.ref) refVideos[name].pause();
      });
      ref.currentTime = 0;
      rects = buildObjectBoxes(svg, reference.colors);
    }
    gen.currentTime = ref.currentTime;
    play(ref);
    play(gen);

    buildCaption(example, reference.colors);
    delete stage.dataset.hot;
    picks.forEach(function (pick, k) {
      pick.classList.toggle('is-active', k === i);
      pick.querySelector('.mg-pick-bar').style.transform = '';
    });
    index = i;
    current = example;
    elapsed = 0;
    if (byUser) auto = false;
  }

  function tick(now) {
    var dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    var ref = refVideos[current.ref], gen = genVideos[current.id];

    placeObjectBoxes(rects, data.references[current.ref].boxes, ref, data.fps);
    followVideo(gen, ref);

    if (auto && !held) {
      elapsed += dt;
      picks[index].querySelector('.mg-pick-bar').style.transform = 'scaleX(' + Math.min(elapsed / DWELL, 1) + ')';
      if (elapsed >= DWELL) show((index + 1) % data.examples.length, false);
    }
    requestAnimationFrame(tick);
  }

  picks.forEach(function (pick, i) {
    pick.addEventListener('click', function () { show(i, true); });
  });
  stage.addEventListener('mouseenter', function () { held = true; });
  stage.addEventListener('mouseleave', function () { held = false; });
  bindObjectTags(stage, caption);

  show(0, false);
  requestAnimationFrame(tick);
}

function bindCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var text = document.getElementById(button.dataset.copy).innerText.trim();
      var done = function () {
        var label = button.textContent;
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = label; }, 1500);
      };
      var fallback = function () {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { if (document.execCommand('copy')) done(); } catch (e) {}
        document.body.removeChild(area);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });
}

function bindMoreMenu() {
  var menu = document.querySelector('.mg-more');
  if (!menu) return;
  document.addEventListener('click', function (event) {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') menu.open = false;
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
  Promise.race([fontsReady, new Promise(function (resolve) { setTimeout(resolve, 1500); })]).then(playTitleIntro);

  bindMoreMenu();
  bindCopyButtons();
  initTeaserStage();
  initResultsCarousel();
  initApplications();
});
