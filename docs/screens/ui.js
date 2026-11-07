/* CraftMe screens: chrome (header, sidebar, footer, reviewer bar) and small behaviours.
   A page opts in with attributes on <body>:
     data-screen="S09"   data-layout="public|shell-artist|shell-admin|auth|plain"
     data-user="guest|buyer|artist|admin"   data-active="nav key"   data-states="a,b,c" (hash selects one)
   Elements with data-s="a b" show only in those states. Elements with data-c="Name" get a label when "Labels" is on. */
(function () {
  'use strict';
  var D = window.CM_DATA || { CATS: [], ARTISTS: [], ARTWORKS: [], SCREENS: [] };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var B = document.body;

  /* ---------- icons ---------- */
  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 5a3.5 3.5 0 0 1 0 7m3 8a6 6 0 0 0-3-5"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-9 9"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    package: '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4m0 3v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    external: '<path d="M14 4h6v6M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z"/>',
    home: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 14h2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
    flag: '<path d="M5 21V4m0 0h12l-2 4 2 4H5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9m0-5v5h5M4 13a8 8 0 0 0 14 4l2-2m0 5v-5h-5"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    gavel: '<path d="m14 5 5 5M11 8l5 5M4 20l7-7M9 3l7 7-3 3-7-7z"/>',
    chart: '<path d="M4 20V4m0 16h16"/><path d="m8 15 4-5 3 3 5-7"/>'
  };
  function ic(n, s) { s = s || 18; return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  window.CM = { ic: ic, inr: inr, refresh: refresh, toast: toast, icons: ICONS };

  /* ---------- theme ---------- */
  try { var th = localStorage.getItem('cm-theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) { }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cm-theme', next); } catch (e) { }
    setTimeout(refresh, 30);
  }

  /* ---------- chrome ---------- */
  var layout = B.dataset.layout || 'public';
  var user = B.dataset.user || 'guest';
  var active = B.dataset.active || '';
  var cartCount = B.dataset.cart != null ? +B.dataset.cart : 2;
  var NAMES = { buyer: ['Ananya Verma', 'AV'], artist: ['Meera Iyer', 'MI'], admin: ['Admin', 'AD'] };
  var who = NAMES[user] || NAMES.buyer;

  function logo(label) {
    return '<a class="logo" href="home.html"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/></svg>CraftMe' + (label ? '<small>' + label + '</small>' : '') + '</a>';
  }
  function cur(k) { return active === k ? ' aria-current="page"' : ''; }

  function bell() {
    var items = [
      ['truck', 'Your Order #CM-20418 was Shipped', 'Brass Heron · 2 hours ago', 1],
      ['check', 'Review approved', 'Your Review of Meera Iyer is now public · Yesterday', 0],
      ['alert', 'Damage Report decided', 'Refund of ₹2,500 issued · 3 days ago', 0]
    ];
    return '<div class="dd"><button class="iconbtn" data-dd aria-label="Notifications" aria-expanded="false">' + ic('bell', 20) + '<span class="count">2</span></button>' +
      '<div class="menu notif" hidden><div class="mh" style="padding:12px 14px 8px"><span>Notifications</span><a href="notifications.html" style="width:auto;padding:0;color:var(--accent)">See all</a></div>' +
      items.map(function (i) { return '<a class="item' + (i[3] ? ' unread' : '') + '" href="notifications.html">' + ic(i[0], 18) + '<span><span class="t">' + i[1] + '</span><span class="s">' + i[2] + '</span></span></a>'; }).join('') +
      '<button style="justify-content:center;color:var(--accent);font-weight:600;border-radius:0 0 10px 10px" data-toast="All marked as read">Mark all as read</button></div></div>';
  }
  function avatarMenu() {
    var links = '<a href="orders.html">' + ic('package') + 'My orders</a><a href="profile.html">' + ic('user') + 'Profile</a><a href="notifications.html">' + ic('bell') + 'Notifications</a>';
    if (user === 'artist') links = '<a href="dash-home.html">' + ic('dashboard') + 'Artist dashboard</a><a href="artist-profile.html">' + ic('eye') + 'View my public profile</a>' + links;
    else if (user === 'admin') links = '<a href="admin-dashboard.html">' + ic('shield') + 'Admin</a>' + links;
    else links += '<a href="become-artist.html">' + ic('tag') + 'Become an Artist</a>';
    return '<div class="dd"><button class="iconbtn" data-dd aria-label="Account menu" aria-expanded="false"><span class="avatar sm">' + who[1] + '</span></button>' +
      '<div class="menu" hidden><div class="mh"><span>' + who[0] + '</span></div>' + links + '<hr><a href="home.html">' + ic('logout') + 'Log out</a></div></div>';
  }
  function publicHeader() {
    var cats = D.CATS.map(function (c) { return '<a href="browse.html">' + c + '</a>'; }).join('');
    var nav = '<a href="browse.html"' + cur('browse') + '>Browse</a><div class="dd"><button data-dd aria-expanded="false">Categories ' + ic('chevron-down', 16) + '</button><div class="menu left" hidden>' + cats + '</div></div><a href="become-artist.html"' + cur('sell') + '>Sell your art</a>';
    var acts = user === 'guest'
      ? '<a class="btn btn-ghost btn-sm" href="login.html">Log in</a><a class="btn btn-primary btn-sm" href="signup.html">Sign up</a>'
      : '<a class="iconbtn" href="cart.html" aria-label="Cart, ' + cartCount + ' items">' + ic('cart', 20) + (cartCount ? '<span class="count">' + cartCount + '</span>' : '') + '</a>' + bell() + avatarMenu();
    var search = '<form class="hsearch" role="search" data-demo data-next="browse.html" data-loading="0">' + ic('search', 18) + '<input class="input" type="search" placeholder="Search Artworks and Artists" aria-label="Search"></form>';
    return '<div class="testbar">Design preview · nothing here is real</div>' +
      '<header class="site-header"><div class="wrap bar">' + logo() + '<nav class="nav" aria-label="Main">' + nav + '</nav>' + search + '<div class="hactions">' + acts +
      '<button class="iconbtn burger" data-burger aria-label="Open menu" aria-expanded="false">' + ic('menu', 22) + '</button></div></div>' +
      '<div class="wrap mobile-search">' + search.replace('class="hsearch"', 'class="hsearch" style="display:block;max-width:none"') + '</div>' +
      '<div class="mobile-menu" hidden><div class="wrap"><nav class="nav" aria-label="Mobile">' + '<a href="browse.html">Browse</a>' + D.CATS.map(function (c) { return '<a href="browse.html">' + c + '</a>'; }).join('') + '<a href="become-artist.html">Sell your art</a></nav></div></div></header>';
  }
  function shellHeader(kind) {
    var label = kind === 'admin' ? 'Admin' : 'Artist';
    var acts = (kind === 'artist' ? '<a class="btn btn-secondary btn-sm" href="artist-profile.html">' + ic('eye', 16) + 'View my shop</a>' : '<a class="btn btn-secondary btn-sm" href="home.html">' + ic('eye', 16) + 'View site</a>') + bell() + avatarMenu();
    return '<div class="testbar">Design preview · nothing here is real</div><header class="site-header"><div class="wrap bar" style="max-width:none">' + logo(label) + '<div class="hactions">' + acts + '</div></div></header>';
  }
  function sidebar(kind) {
    var L = kind === 'admin'
      ? [['overview', 'admin-dashboard.html', 'dashboard', 'Overview'], ['queues', 'admin-queues.html', 'inbox', 'Queues', '12'], ['orders', 'admin-orders.html', 'receipt', 'Orders'], ['payouts', 'admin-payout-run.html', 'wallet', 'Payout run', '1 Dec'], ['artists', 'admin-artists.html', 'users', 'Artists'], ['settings', 'admin-settings.html', 'settings', 'Settings']]
      : [['overview', 'dash-home.html', 'dashboard', 'Overview'], ['artworks', 'dash-artworks.html', 'image', 'Artworks'], ['orders', 'dash-orders.html', 'inbox', 'Orders', '3'], ['payouts', 'dash-payouts.html', 'wallet', 'Payouts'], ['instagram', 'dash-instagram.html', 'instagram', 'Instagram'], ['settings', 'dash-settings.html', 'settings', 'Settings']];
    return '<aside class="side' + (kind === 'admin' ? ' dark' : '') + '" aria-label="' + kind + ' navigation"><div class="grp">' + (kind === 'admin' ? 'Operate' : 'My shop') + '</div>' +
      L.map(function (l) { return '<a href="' + l[1] + '"' + (active === l[0] ? ' aria-current="page"' : '') + '>' + ic(l[2]) + l[3] + (l[4] ? '<span class="badge ' + (kind === 'admin' ? 'accent' : 'warn') + '">' + l[4] + '</span>' : '') + '</a>'; }).join('') +
      '<div class="foot"><a href="home.html">' + ic('arrow-left') + 'Back to CraftMe</a><a href="home.html">' + ic('logout') + 'Log out</a></div></aside>';
  }
  function footer() {
    var cats = D.CATS.slice(0, 5).map(function (c) { return '<li><a href="browse.html">' + c + '</a></li>'; }).join('');
    return '<footer class="site-footer"><div class="wrap"><div class="cols"><div class="stack sm">' + logo() + '<p class="muted small" style="max-width:34ch">Original art and prints from independent Indian Artists, shipped by the Artist, protected by CraftMe.</p></div>' +
      '<div><h4>Shop</h4><ul>' + cats + '</ul></div>' +
      '<div><h4>For Artists</h4><ul><li><a href="become-artist.html">Sell your art</a></li><li><a href="legal.html#artist">Artist agreement</a></li><li><a href="legal.html#refunds">Refunds and Payouts</a></li><li><a href="dash-home.html">Artist dashboard</a></li></ul></div>' +
      '<div><h4>Help</h4><ul><li><a href="legal.html#refunds">Refund policy</a></li><li><a href="legal.html#terms">Terms</a></li><li><a href="legal.html#privacy">Privacy</a></li><li><a href="legal.html#deletion">Delete my data</a></li></ul></div></div>' +
      '<div class="legal"><span>© 2026 CraftMe · Made in India · Prices in ₹, shipping within India included</span><span>Demo build, draft legal text</span></div></div></footer>';
  }

  var main = $('main');
  if (main) {
    if (layout === 'public') {
      B.insertAdjacentHTML('afterbegin', publicHeader());
      main.insertAdjacentHTML('afterend', footer());
    } else if (layout === 'shell-artist' || layout === 'shell-admin') {
      var kind = layout === 'shell-admin' ? 'admin' : 'artist';
      B.insertAdjacentHTML('afterbegin', shellHeader(kind));
      var shell = document.createElement('div'); shell.className = 'shell';
      main.parentNode.insertBefore(shell, main);
      shell.insertAdjacentHTML('beforeend', sidebar(kind));
      main.classList.add('content'); shell.appendChild(main);
    } else if (layout === 'auth') {
      B.insertAdjacentHTML('afterbegin', '<div class="testbar">Design preview · nothing here is real</div><header class="site-header"><div class="wrap bar">' + logo() + '<div class="hactions"><a class="btn btn-ghost btn-sm" href="browse.html">Continue browsing</a></div></div></header>');
    }
  }

  /* ---------- icons in markup, stars, cards ---------- */
  function hydrate(root) {
    $$('i[data-i]', root).forEach(function (el) { el.outerHTML = ic(el.dataset.i, +el.dataset.size || 18); });
    $$('[data-stars]', root).forEach(function (el) {
      var r = parseFloat(el.dataset.stars), s = +el.dataset.size || 14;
      var st = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + ICONS.star + '</svg>';
      el.classList.add('stars'); el.setAttribute('role', 'img'); el.setAttribute('aria-label', r + ' out of 5');
      el.innerHTML = '<span style="display:inline-flex">' + st.repeat(5) + '</span><span class="on" style="width:' + (r / 5 * 100) + '%">' + st.repeat(5) + '</span>';
      el.removeAttribute('data-stars');
    });
    $$('[data-artcards]', root).forEach(function (el) {
      var ids = el.dataset.artcards.split(',').map(Number);
      el.innerHTML = ids.map(function (id) {
        var a = D.ARTWORKS.filter(function (x) { return x.id === id; })[0]; if (!a) return '';
        var ar = D.ARTISTS.filter(function (x) { return x.id === a.artist; })[0];
        var live = a.listings.filter(function (l) { return l[2] > 0; }); var pool = live.length ? live : a.listings;
        var from = Math.min.apply(null, pool.map(function (l) { return l[1]; }));
        var kinds = a.listings.map(function (l) { return l[0]; }).filter(function (v, i, s) { return s.indexOf(v) === i; }).join(' + ');
        var rr = a.ratio.split('/'); var rt = rr[0] / rr[1]; var wpct = rt >= 1 ? 100 : Math.round(rt * 100);
        return '<a class="art-card" href="artwork.html' + (a.sold ? '#sold' : '') + '"><div class="mat">' + (a.sold ? '<span class="badge solid sold-tag">Sold</span>' : '') +
          '<canvas class="art" style="width:' + wpct + '%" data-seed="' + a.seed + '" data-style="' + a.style + '" data-ratio="' + a.ratio + '" role="img" aria-label="' + a.title + '"></canvas></div>' +
          '<div class="wall-label"><span class="meta">' + a.cat.toUpperCase() + ' · ' + a.year + '</span><span class="title">' + a.title + '</span><span>' + ar.name + ', ' + ar.city + '</span>' +
          '<div class="row"><span class="meta">' + kinds + '</span><span class="price sm">' + (a.sold ? 'Sold' : (live.length > 1 ? 'from ' : '') + inr(from)) + '</span></div></div></a>';
      }).join('');
      el.removeAttribute('data-artcards');
    });
    $$('[data-rate]', root).forEach(function (el) {
      var val = +el.dataset.rate || 0, btns = '';
      for (var i = 1; i <= 5; i++) btns += '<button type="button" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '" data-v="' + i + '"><svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">' + ICONS.star + '</svg></button>';
      el.classList.add('rate-input'); el.innerHTML = btns;
      function paint(v) { $$('button', el).forEach(function (b) { b.classList.toggle('on', +b.dataset.v <= v); }); }
      paint(val);
      el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; val = +b.dataset.v; paint(val); var o = $('#' + el.dataset.out); if (o) o.textContent = val + ' of 5'; });
      el.addEventListener('mouseover', function (e) { var b = e.target.closest('button'); if (b) paint(+b.dataset.v); });
      el.addEventListener('mouseleave', function () { paint(val); });
    });
  }

  /* ---------- charts ---------- */
  function niceMax(v) { var e = Math.pow(10, Math.floor(Math.log10(v || 1))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  function tick(v, money) { if (!money) return String(Math.round(v * 10) / 10); if (v >= 100000) return '₹' + (v / 100000) + 'L'; if (v >= 1000) return '₹' + (v / 1000) + 'k'; return '₹' + v; }
  function chart(el) {
    if (!el.clientWidth || !el.dataset.series) return;
    var W = el.clientWidth, H = +el.dataset.h || 240, m = { l: 48, r: 12, t: 12, b: 28 };
    var labels = el.dataset.labels.split(','), series = JSON.parse(el.dataset.series), money = el.dataset.money, kind = el.dataset.chart;
    var flat = [].concat.apply([], series), max = niceMax(Math.max.apply(null, flat));
    var iw = W - m.l - m.r, ih = H - m.t - m.b, n = labels.length, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (el.dataset.title || 'Chart') + '">';
    for (var i = 0; i <= 4; i++) { var y = m.t + ih - ih * i / 4; s += '<line class="grid-l" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/><text class="axis-t" x="' + (m.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + tick(max * i / 4, money) + '</text>'; }
    var step = Math.ceil(n / Math.max(1, iw / 56));
    labels.forEach(function (l, k) { if (k % step) return; var x = kind === 'bars' ? m.l + iw * (k + .5) / n : m.l + iw * (n === 1 ? .5 : k / (n - 1)); s += '<text class="axis-t" x="' + x + '" y="' + (H - 8) + '" text-anchor="middle">' + l + '</text>'; });
    if (kind === 'bars') {
      var gw = iw / n * .66, bw = gw / series.length;
      series.forEach(function (d, si) { d.forEach(function (v, k) { var h = ih * v / max, x = m.l + iw * (k + .5) / n - gw / 2 + si * bw; s += '<rect class="f' + si + '" x="' + x + '" y="' + (m.t + ih - h) + '" width="' + (bw - 2) + '" height="' + h + '" rx="2"/>'; }); });
    } else {
      series.forEach(function (d, si) {
        var pts = d.map(function (v, k) { return [m.l + iw * (n === 1 ? .5 : k / (n - 1)), m.t + ih - ih * v / max]; });
        var path = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L');
        if (si === 0) s += '<path class="area" d="' + path + 'L' + pts[pts.length - 1][0] + ',' + (m.t + ih) + 'L' + pts[0][0] + ',' + (m.t + ih) + 'Z"/>';
        s += '<path class="s' + si + '" d="' + path + '" fill="none" stroke-width="2.4" stroke-linejoin="round"/>';
        var e = pts[pts.length - 1]; s += '<circle class="f' + si + '" cx="' + e[0] + '" cy="' + e[1] + '" r="4"/>';
      });
    }
    el.innerHTML = s + '</svg>';
  }

  /* ---------- toasts ---------- */
  var toasts;
  function toast(msg, kind) {
    if (!toasts) { toasts = document.createElement('div'); toasts.className = 'toasts'; toasts.setAttribute('role', 'status'); B.appendChild(toasts); }
    var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = ic(kind === 'err' ? 'alert' : 'check', 18) + '<span>' + msg + '</span>';
    toasts.appendChild(t); setTimeout(function () { t.remove(); }, 3200);
  }

  /* ---------- states ---------- */
  function applyState() {
    var keys = (B.dataset.states || 'default').split(',');
    var h = location.hash.replace('#', ''); if (keys.indexOf(h) < 0) h = B.dataset.state || keys[0];
    B.dataset.state = h;
    $$('[data-s]').forEach(function (el) { el.hidden = el.dataset.s.split(' ').indexOf(h) < 0; });
    $$('.rv [data-state]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.state === h ? 'true' : 'false'); });
    $$('.stepper').forEach(function (st) {
      var v = Array.prototype.filter.call(st.children, function (l) { return !l.hidden; });
      Array.prototype.forEach.call(st.children, function (l) { l.classList.remove('last'); });
      if (v.length) v[v.length - 1].classList.add('last');
    });
    refresh();
  }
  function refresh() {
    if (window.CM_drawAllArt) window.CM_drawAllArt();
    $$('.chart').forEach(chart);
  }

  /* ---------- reviewer bar ---------- */
  function reviewerBar() {
    var id = B.dataset.screen, list = D.SCREENS, idx = -1;
    list.forEach(function (s, i) { if (s.id === id) idx = i; });
    var sc = list[idx]; if (!sc) return;
    var prev = list[idx - 1], next = list[idx + 1];
    var states = (sc.states || []).filter(function () { return sc.states.length > 1; });
    var bar = document.createElement('div'); bar.className = 'rv'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Screen review controls');
    bar.innerHTML = '<span class="id">' + sc.id + ' · ' + sc.name + '</span><span class="lbl">' + sc.route + '</span>' +
      (states.length ? '<span class="states"><span class="lbl">State</span>' + states.map(function (s) { return '<button type="button" data-state="' + s[0] + '" aria-pressed="false">' + s[1] + '</button>'; }).join('') + '</span>' : '') +
      '<span class="sp"></span>' +
      (prev ? '<a href="' + prev.file + '" title="' + prev.name + '">' + ic('chevron-left', 14) + prev.id + '</a>' : '') +
      '<a href="index.html">All screens</a>' +
      (next ? '<a href="' + next.file + '" title="' + next.name + '">' + next.id + ic('chevron-right', 14) + '</a>' : '') +
      '<button type="button" data-annot aria-pressed="false">Labels</button><button type="button" data-theme-toggle aria-label="Toggle light or dark">' + ic('moon', 14) + '</button>';
    B.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var st = e.target.closest('[data-state]'); if (st) { location.hash = st.dataset.state; return; }
      var an = e.target.closest('[data-annot]'); if (an) { var on = B.classList.toggle('annot'); an.setAttribute('aria-pressed', on); return; }
      if (e.target.closest('[data-theme-toggle]')) toggleTheme();
    });
  }

  /* ---------- behaviours ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var dd = t.closest('[data-dd]');
    $$('.dd .menu').forEach(function (m) { if (!dd || m !== dd.nextElementSibling) { if (!m.contains(t)) m.hidden = true; } });
    if (dd) { var menu = dd.nextElementSibling; menu.hidden = !menu.hidden; dd.setAttribute('aria-expanded', !menu.hidden); return; }
    var bg = t.closest('[data-burger]'); if (bg) { var mm = $('.mobile-menu'); mm.hidden = !mm.hidden; bg.setAttribute('aria-expanded', !mm.hidden); return; }
    var op = t.closest('[data-open]'); if (op) { var m = document.getElementById(op.dataset.open); if (m) { m.hidden = false; refresh(); var f = $('input,select,textarea,button', m); } return; }
    var cl = t.closest('[data-close]'); if (cl) { var bk = cl.closest('.modal-backdrop'); if (bk) bk.hidden = true; if (cl.dataset.toast) toast(cl.dataset.toast); return; }
    if (t.classList && t.classList.contains('modal-backdrop') && !t.hasAttribute('data-static')) { t.hidden = true; return; }
    var ts = t.closest('[data-toast]'); if (ts) { toast(ts.dataset.toast, ts.dataset.kind); }
    var cp = t.closest('[data-copy]'); if (cp) { var txt = cp.dataset.copy; try { navigator.clipboard.writeText(txt).then(function () { toast('Copied ' + txt); }, function () { toast('Press Ctrl+C to copy ' + txt); }); } catch (x) { toast('Press Ctrl+C to copy ' + txt); } }
    var pw = t.closest('[data-pw]'); if (pw) { var inp = document.getElementById(pw.dataset.pw); inp.type = inp.type === 'password' ? 'text' : 'password'; pw.innerHTML = ic(inp.type === 'password' ? 'eye' : 'lock', 18); }
    var chip = t.closest('.chip[aria-pressed]'); if (chip) { var grp = chip.closest('[data-exclusive]'); if (grp) $$('.chip', grp).forEach(function (c) { c.setAttribute('aria-pressed', c === chip); }); else chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') !== 'true'); }
    var mth = t.closest('.method'); if (mth) { $$('.method', mth.parentNode).forEach(function (c) { c.setAttribute('aria-pressed', c === mth); }); }
    var q = t.closest('.qty button'); if (q) { var qi = $('input', q.parentNode), v = +qi.value + (q.dataset.d === '+' ? 1 : -1), mx = +(qi.dataset.max || 99); qi.value = Math.max(1, Math.min(mx, v)); if (v > mx) toast('Only ' + mx + ' in stock', 'err'); }
    var gt = t.closest('[data-gallery] button[data-seed]'); if (gt) { var gm = $('#' + gt.closest('[data-gallery]').dataset.gallery); $$('button', gt.parentNode).forEach(function (b) { b.setAttribute('aria-current', b === gt); }); gm.dataset.seed = gt.dataset.seed; if (gt.dataset.style) gm.dataset.style = gt.dataset.style; window.CM_drawArt(gm); }
    var tg = t.closest('[data-toggle]'); if (tg) { var tgt = document.getElementById(tg.dataset.toggle); if (tgt) tgt.hidden = !tgt.hidden; }
    var xb = t.closest('.thumb .x'); if (xb) { xb.closest('.thumb').remove(); }
    var pk = t.closest('.embed[data-pick]'); if (pk) { pk.classList.toggle('picked'); var cnt = $('#pick-count'); if (cnt) cnt.textContent = $$('.embed.picked').length; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $$('.modal-backdrop').forEach(function (m) { if (!m.hasAttribute('data-static')) m.hidden = true; }); $$('.dd .menu').forEach(function (m) { m.hidden = true; }); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f.hasAttribute('data-demo')) return; e.preventDefault();
    var btn = $('[type=submit]', f), next = f.dataset.next;
    if (f.dataset.loading === '0') { if (next) location.href = next; return; }
    if (btn) btn.classList.add('is-loading');
    setTimeout(function () { if (btn) btn.classList.remove('is-loading'); if (f.dataset.ok) toast(f.dataset.ok); if (next) setTimeout(function () { location.href = next; }, 500); }, 900);
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.counter) { var c = document.getElementById(t.dataset.counter); if (c) c.textContent = t.value.length + ' / ' + t.maxLength; }
    if (t.dataset && t.dataset.out) { var o = document.getElementById(t.dataset.out); if (o) o.textContent = t.dataset.money ? inr(t.value) : t.value; }
    if (t.closest && t.closest('.otp')) { if (t.value.length === 1 && t.nextElementSibling) t.nextElementSibling.focus(); }
  });
  document.addEventListener('keydown', function (e) { var t = e.target; if (e.key === 'Backspace' && t.closest && t.closest('.otp') && !t.value && t.previousElementSibling) t.previousElementSibling.focus(); });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'file' && t.dataset.preview) {
      var host = document.getElementById(t.dataset.preview); if (!host) return;
      Array.prototype.forEach.call(t.files, function (file) {
        if (!/^image\//.test(file.type)) { toast(file.name + ' added'); return; }
        var url = URL.createObjectURL(file), d = document.createElement('div'); d.className = 'thumb';
        d.innerHTML = '<img alt="" src="' + url + '"><button type="button" class="x" aria-label="Remove photo">' + ic('x', 14) + '</button>'; host.appendChild(d);
      });
    }
  });

  /* tabs */
  $$('[data-tabs]').forEach(function (g) {
    var tabs = $$('.tab', g);
    function sel(t) {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
      tabs.forEach(function (x) { var p = document.getElementById(x.dataset.tab); if (p) p.hidden = x.dataset.tab !== t.dataset.tab; });
      refresh();
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { sel(t); if (g.dataset.hash) history.replaceState(null, '', '#' + t.dataset.tab); }); });
    var h = g.dataset.hash ? location.hash.replace('#', '') : '';
    sel(tabs.filter(function (t) { return t.dataset.tab === h; })[0] || tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);
  });

  /* countdowns */
  $$('[data-countdown]').forEach(function (el) {
    var p = el.dataset.countdown.split(':'), left = (+p[0]) * 60 + (+p[1]);
    function show() { el.textContent = ('0' + Math.floor(left / 60)).slice(-2) + ':' + ('0' + left % 60).slice(-2); }
    show(); var iv = setInterval(function () { if (left <= 0) { clearInterval(iv); el.classList.add('err-t'); return; } left--; show(); }, 1000);
  });

  /* headline words rise in once on load */
  $$('main h1').forEach(function (h) {
    if (h.children.length || !h.textContent.trim()) return;
    var t = h.textContent.trim(); h.setAttribute('aria-label', t);
    h.innerHTML = t.split(/\s+/).map(function (w, i) { return '<span class="w" aria-hidden="true" style="--i:' + i + '">' + w + '</span>'; }).join(' ');
  });

  /* ---------- boot ---------- */
  hydrate(document);
  reviewerBar();
  window.addEventListener('hashchange', applyState);
  applyState();
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { $$('.chart').forEach(chart); }); $$('.chart').forEach(function (c) { ro.observe(c); }); }
  window.addEventListener('load', refresh);
})();
