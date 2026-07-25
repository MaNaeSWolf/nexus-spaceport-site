/* REFERENCE COPY ONLY — not loaded by the page. Live version is inlined at the bottom of ../index.html. */
/* ==========================================================================
   NEXUS — orbital background
   Interactive wireframe Earth. Draws a graticule sphere, simplified coastlines
   and country outlines, the three Nexus launch sites, and animated
   great-circle ascent trajectories.

   Orbits are held in an inertial frame: a vehicle's plane is fixed at the moment
   it leaves the pad, and the Earth then rotates underneath it. Successive launches
   from the same site therefore fan out in right ascension. Decorative only.
   ========================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('globe');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, R = 0, CX = 0, CY = 0;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- decode embedded coastline / border rings -------------------- */
  var RINGS = (function () {
    var raw = window.__NX_COAST__ || '';
    var out = [];
    var parts = raw.split(';');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var v = parts[i].split(',');
      var px = 0, py = 0, ring = [];
      for (var j = 0; j < v.length; j += 2) {
        px += +v[j]; py += +v[j + 1];
        var lat = py / 10, lon = px / 10;
        if (lat < -84) lat = -84;               // collapse Antarctic clip edge
        ring.push(unit(lat, lon));
      }
      out.push(ring);
    }
    return out;
  })();

  function unit(lat, lon) {
    var a = lat * Math.PI / 180, b = lon * Math.PI / 180;
    var c = Math.cos(a);
    return [c * Math.cos(b), Math.sin(a), c * Math.sin(b)];
  }

  /* ---------- launch sites ----------------------------------------------- */
  /* az = launch azimuth (deg true). inc = resulting orbital inclination. */
  var SITES = [
    {
      id: 'moz', name: 'MORRUMBENE', sub: 'MOZAMBIQUE', lat: -23.596, lon: 35.421,
      tracks: [
        { az: 115, inc: '33.8°', label: 'LOW-INCLINATION' },
        { az: 150, inc: '62.7°', label: 'HIGH-INCLINATION' }
      ]
    },
    {
      id: 'phl', name: 'PALAWAN', sub: 'PHILIPPINES', lat: 8.531, lon: 117.545,
      tracks: [
        { az: 115, inc: '26.3°', label: 'LOW-INCLINATION' },
        { az: 120, inc: '31.1°', label: 'LOW-INCLINATION' }
      ]
    },
    {
      id: 'gha', name: 'AHANTA WEST', sub: 'GHANA', lat: 4.75, lon: -2.08,
      tracks: [
        { az: 155, inc: '65.1°', label: 'HIGH-INCLINATION' },
        { az: 190, inc: '100.0°', label: 'SUN-SYNCHRONOUS' }
      ]
    }
  ];

  /* great-circle waypoint: angular distance d (rad) along azimuth az from site */
  function waypoint(latDeg, lonDeg, azDeg, d) {
    var p1 = latDeg * Math.PI / 180, l1 = lonDeg * Math.PI / 180, az = azDeg * Math.PI / 180;
    var sp = Math.sin(p1), cp = Math.cos(p1), sd = Math.sin(d), cd = Math.cos(d);
    var p2 = Math.asin(sp * cd + cp * sd * Math.cos(az));
    var l2 = l1 + Math.atan2(Math.sin(az) * sd * cp, cd - sp * Math.sin(p2));
    var c = Math.cos(p2);
    return [c * Math.cos(l2), Math.sin(p2), c * Math.sin(l2)];
  }

  /* precompute each orbital plane as a full great-circle ring ------------- */
  var RING = 160;                    // samples around the full orbit
  var AMAX = 0.10;                   // orbital altitude, in Earth radii
  var ORBITS = 3;                    // revolutions before a fresh launch
  var PER_TRACK = 3;                 // vehicles in flight per plane
  var ASCENT_ARC = 0.60;             // rad of arc spent in powered ascent (~34deg)
  var ASCENT_FRAC = 0.13;            // fraction of the cycle spent ascending

  function altAt(a) { return 1 + AMAX * (1 - Math.exp(-6 * a)); }

  SITES.forEach(function (s) {
    s.pos = unit(s.lat, s.lon);
    s.tracks.forEach(function (t) {
      t.ring = [];
      for (var i = 0; i < RING; i++) {
        var d = i / RING * Math.PI * 2;
        var p = waypoint(s.lat, s.lon, t.az, d);
        t.ring.push([p[0], p[1], p[2], altAt(d)]);
      }
      t.period = 30 + Math.random() * 14;
      t.objs = [];
      for (var k = 0; k < PER_TRACK; k++) t.objs.push(Math.random());
    });
  });

  /* arc travelled since launch, as a function of cycle position u in [0,1) */
  function arcAt(u) {
    if (u < ASCENT_FRAC) return ASCENT_ARC * (u / ASCENT_FRAC);
    var f = (u - ASCENT_FRAC) / (1 - ASCENT_FRAC);
    return ASCENT_ARC + f * (ORBITS * Math.PI * 2 - ASCENT_ARC);
  }

  /* ---------- camera ------------------------------------------------------
     camYaw  — where the camera sits (eased, nudged by the pointer)
     theta   — Earth's own rotation about its polar axis, monotonic
     An Earth-fixed point is drawn at yaw = camYaw + theta.
     An orbital plane launched when Earth was at thetaL is inertially fixed,
     so it is drawn at yaw = camYaw + thetaL — the Earth slides beneath it.
     ------------------------------------------------------------------------ */
  var camYaw = 0.8727, pitch = 0.24;   // centre ~40degE: all three sites in view
  var theta = 0;
  var spin = 0.050;            // rad / s Earth rotation (~2 min per revolution)
  var pointer = { x: 0.5, y: 0.5, active: false };
  var scrollN = 0;

  function rot(p, yawV) {
    var cy = Math.cos(yawV), sy = Math.sin(yawV);
    var x = p[0] * cy - p[2] * sy;
    var z = p[0] * sy + p[2] * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y = p[1] * cp - z * sp;
    var z2 = p[1] * sp + z * cp;
    return [x, y, z2];
  }
  function projY(p, alt, yawV) {
    var r = alt || 1;
    var v = rot(p, yawV);
    return [CX - v[0] * R * r, CY - v[1] * R * r, v[2]];   // -x so east renders right
  }
  /* Earth-fixed geometry: coastlines, graticule, pads */
  function proj(p, alt) { return projY(p, alt, camYaw + theta); }

  /* ---------- resize ------------------------------------------------------ */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var m = Math.min(W, H);
    R = m * (W < 760 ? 0.44 : 0.40);
    CX = W * (W < 760 ? 0.5 : 0.68);
    CY = H * 0.5;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- interaction ------------------------------------------------- */
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX / window.innerWidth;
    pointer.y = e.clientY / window.innerHeight;
    pointer.active = true;
  }, { passive: true });

  window.addEventListener('scroll', function () {
    var max = Math.max(1, document.body.scrollHeight - window.innerHeight);
    scrollN = Math.min(1, window.scrollY / max);
  }, { passive: true });

  /* ---------- palette ----------------------------------------------------- */
  var C = {
    grid: [77, 168, 255],
    land: [140, 205, 255],
    hot: [255, 122, 60],
    site: [255, 210, 120]
  };
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---------- drawing ----------------------------------------------------- */
  function drawGraticule() {
    var i, j, lat, lon, first, p;
    // meridians
    for (lon = -180; lon < 180; lon += 15) {
      ctx.beginPath(); first = true;
      for (lat = -90; lat <= 90; lat += 4) {
        p = proj(unit(lat, lon));
        if (first) { ctx.moveTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]);
      }
      ctx.strokeStyle = rgba(C.grid, 0.055); ctx.lineWidth = 0.6; ctx.stroke();
    }
    // parallels
    for (lat = -75; lat <= 75; lat += 15) {
      ctx.beginPath(); first = true;
      for (lon = -180; lon <= 180; lon += 4) {
        p = proj(unit(lat, lon));
        if (first) { ctx.moveTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]);
      }
      var eq = (lat === 0);
      ctx.strokeStyle = rgba(C.grid, eq ? 0.16 : 0.055);
      ctx.lineWidth = eq ? 0.9 : 0.6;
      ctx.stroke();
    }
    // limb
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(C.grid, 0.20); ctx.lineWidth = 1; ctx.stroke();
  }

  function drawLand() {
    for (var i = 0; i < RINGS.length; i++) {
      var ring = RINGS[i];
      // front-facing pass
      ctx.beginPath();
      var pen = false;
      for (var j = 0; j < ring.length; j++) {
        var p = proj(ring[j]);
        if (p[2] > 0.02) {
          if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]);
        } else pen = false;
      }
      ctx.strokeStyle = rgba(C.land, 0.36); ctx.lineWidth = 0.75; ctx.stroke();

      // far side, dimmer — gives the see-through wireframe read
      ctx.beginPath(); pen = false;
      for (j = 0; j < ring.length; j++) {
        var q = proj(ring[j]);
        if (q[2] <= 0.02) {
          if (!pen) { ctx.moveTo(q[0], q[1]); pen = true; } else ctx.lineTo(q[0], q[1]);
        } else pen = false;
      }
      ctx.strokeStyle = rgba(C.land, 0.075); ctx.lineWidth = 0.6; ctx.stroke();
    }
  }

  function drawTracks(time) {
    var s, k, j, i, tr, site;

    for (s = 0; s < SITES.length; s++) {
      site = SITES[s];

      for (k = 0; k < site.tracks.length; k++) {
        tr = site.tracks[k];

        for (j = 0; j < tr.objs.length; j++) {
          var raw = (time / tr.period) + tr.objs[j] + j / tr.objs.length;
          var u = raw - Math.floor(raw);

          /* Earth's rotation angle at the instant this vehicle left the pad.
             The plane is inertially fixed from then on. */
          var tLaunch = (Math.floor(raw) - tr.objs[j] - j / tr.objs.length) * tr.period;
          var yawL = camYaw + spin * tLaunch;

          var arc = arcAt(u);
          var ascending = arc < ASCENT_ARC * 0.999;

          /* ---- the orbital plane this vehicle is flying ---- */
          var ring = tr.ring, pj = [], pen = false;
          for (i = 0; i < RING; i++) pj.push(projY(ring[i], ring[i][3], yawL));

          ctx.beginPath(); pen = false;
          for (i = 0; i < RING - 1; i++) {
            if (pj[i][2] > 0 && pj[i + 1][2] > 0) {
              if (!pen) { ctx.moveTo(pj[i][0], pj[i][1]); pen = true; }
              ctx.lineTo(pj[i + 1][0], pj[i + 1][1]);
            } else pen = false;
          }
          ctx.strokeStyle = rgba(C.grid, 0.085); ctx.lineWidth = 0.6; ctx.stroke();

          ctx.beginPath(); pen = false;
          for (i = 0; i < RING - 1; i++) {
            if (pj[i][2] <= 0 && pj[i + 1][2] <= 0) {
              if (!pen) { ctx.moveTo(pj[i][0], pj[i][1]); pen = true; }
              ctx.lineTo(pj[i + 1][0], pj[i + 1][1]);
            } else pen = false;
          }
          ctx.strokeStyle = rgba(C.grid, 0.03); ctx.lineWidth = 0.5; ctx.stroke();

          /* ---- trail ---- */
          var trail = ascending ? 17 : 11;
          for (var q = trail; q > 0; q--) {
            var a0 = Math.max(0, arc - q * 0.030);
            var a1 = Math.max(0, arc - (q - 1) * 0.030);
            if (a1 <= 0) continue;
            var p0 = orbitPoint(ring, a0, yawL), p1 = orbitPoint(ring, a1, yawL);
            if (p0[2] < -0.03 && p1[2] < -0.03) continue;
            var f = 1 - q / trail;
            var vis = p1[2] > 0 ? 1 : 0.2;
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
            ctx.strokeStyle = ascending
              ? rgba(C.hot, 0.60 * f * f * vis)
              : rgba([170, 220, 255], 0.32 * f * f * vis);
            ctx.lineWidth = ascending ? (0.7 + 1.6 * f) : (0.5 + 0.7 * f);
            ctx.stroke();
          }

          /* ---- the vehicle ---- */
          var ph = orbitPoint(ring, arc, yawL);
          if (ph[2] > -0.02) {
            var av = ph[2] > 0 ? 1 : 0.22;
            ctx.beginPath();
            ctx.arc(ph[0], ph[1], ascending ? 1.9 : 1.4, 0, Math.PI * 2);
            ctx.fillStyle = rgba(ascending ? [255, 236, 210] : [214, 238, 255], 0.95 * av);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ph[0], ph[1], ascending ? 7 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = ascending ? rgba(C.hot, 0.13 * av) : rgba(C.grid, 0.10 * av);
            ctx.fill();
          }
        }
      }
    }
  }

  /* projected point on an inertially-fixed orbit at arc distance a (rad) */
  function orbitPoint(ring, a, yawV) {
    var t = (((a / (Math.PI * 2)) % 1) + 1) % 1 * RING;
    var i0 = Math.floor(t) % RING, i1 = (i0 + 1) % RING, f = t - Math.floor(t);
    var A = ring[i0], B = ring[i1];
    var p = [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f];
    return projY(p, altAt(a), yawV);
  }

  function drawSites(t) {
    for (var s = 0; s < SITES.length; s++) {
      var site = SITES[s];
      var p = proj(site.pos);
      if (p[2] <= 0.03) continue;
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + s * 2.1);
      var fade = Math.min(1, p[2] * 3.2);

      ctx.beginPath();
      ctx.arc(p[0], p[1], 6 + pulse * 7, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(C.site, 0.28 * (1 - pulse) * fade);
      ctx.lineWidth = 1; ctx.stroke();

      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C.site, 0.92 * fade); ctx.fill();

      // tick + label
      if (W > 900) {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 22, p[1] - 16); ctx.lineTo(p[0] + 62, p[1] - 16);
        ctx.strokeStyle = rgba(C.site, 0.22 * fade); ctx.lineWidth = 0.7; ctx.stroke();
        ctx.font = '9px "Share Tech Mono", ui-monospace, monospace';
        ctx.fillStyle = rgba(C.site, 0.55 * fade);
        ctx.fillText(site.name, p[0] + 26, p[1] - 20);
      }
    }
  }

  /* ---------- loop -------------------------------------------------------- */
  var last = performance.now(), t0 = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    t0 += dt;

    // Earth turns; the camera only drifts with the pointer and the scroll
    theta += spin * dt;
    var px = pointer.active ? (pointer.x - 0.5) : 0;
    var py = pointer.active ? (pointer.y - 0.5) : 0;
    var targetCam = 0.8727 + px * 0.55;
    var targetPitch = 0.22 + py * -0.42 + scrollN * 0.55;
    camYaw += (targetCam - camYaw) * Math.min(1, dt * 2.4);
    pitch += (targetPitch - pitch) * Math.min(1, dt * 2.0);

    ctx.clearRect(0, 0, W, H);

    // faint atmosphere
    var g = ctx.createRadialGradient(CX, CY, R * 0.62, CX, CY, R * 1.25);
    g.addColorStop(0, 'rgba(30,90,160,0.085)');
    g.addColorStop(0.72, 'rgba(20,60,120,0.035)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.25, 0, Math.PI * 2); ctx.fill();

    drawGraticule();
    drawLand();
    drawTracks(t0);
    drawSites(t0);

    requestAnimationFrame(frame);
  }

  if (reduced) {
    spin = 0;
    ctx.clearRect(0, 0, W, H);
    drawGraticule(); drawLand(); drawTracks(0); drawSites(0);
  } else {
    requestAnimationFrame(frame);
  }
})();
