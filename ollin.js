/* ========================================
   Ollin Tuner — interactive dial
   A web rendition of the app's hold-to-tune ritual: an animated Aztec Sun Stone,
   cymatics sand, a 120 → 432 Hz sweep while held, then a spoken transmission.
   Drawn geometry only (the app's glyph font isn't licensed for web embedding).
   ======================================== */
(() => {
    "use strict";
    document.documentElement.classList.add("js");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---------- Scroll reveal ----------
    const revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && !reduceMotion) {
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
            }
        }, { rootMargin: "0px 0px -12% 0px" });
        revealEls.forEach((el) => io.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add("in"));
    }

    const canvas = document.getElementById("dial");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const panel = document.getElementById("ritual-panel");
    const promptEl = document.getElementById("dial-prompt");
    const meterFill = document.getElementById("dial-meter-fill");
    const hzEl = document.getElementById("dial-hz");
    const flashEl = panel.querySelector(".dial-flash");
    const transmissionEl = document.getElementById("transmission");
    const transmissionText = document.getElementById("transmission-text");
    const soundToggle = document.getElementById("sound-toggle");

    // ---------- Palette (from the app) ----------
    const C = {
        gold: "rgb(217,173,77)",
        brightGold: "rgb(235,199,97)",
        glowGold: "rgb(255,217,102)",
        copper: "rgb(184,115,51)",
        obsidian: "rgb(15,13,5)",
        turquoise: "rgb(0,166,140)",
        sclera: "rgb(235,230,217)",
        arms: ["rgb(105,23,28)", "rgb(120,89,56)", "rgb(54,84,89)", "rgb(222,112,84)"]
    };

    const HOLD_SECONDS = 2.5;
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    const TAU = Math.PI * 2;

    const readings = [
        "Yes — but not in the way you expect. Watch for the number seven.",
        "Someone whose name begins with M is thinking of you right now.",
        "You already know the answer. You knew before you asked.",
        "Not yet. Three moons, and then the door opens.",
        "The jade path bends to the left. Follow it without looking back.",
        "Something small you lost will return before the next new moon.",
        "The Fifth Sun favors you today. Say yes to the first invitation.",
        "Something blue is waiting to be noticed. Look closer.",
        "The frequency says yes. The jaguar says be patient.",
        "An old friend is about to reappear. Answer the unexpected message.",
        "Your hands are warmer than usual today. That is not a coincidence.",
        "The obsidian mirror shows a crossroads. Choose the quieter road.",
        "A decision made on a Tuesday will change more than you think.",
        "Yes. The feathers have already fallen in your favor.",
        "Listen for a song you haven’t heard in years. It carries your answer.",
        "The vibration is strong around you. Someone is about to surprise you."
    ];
    let readingBag = [];
    function nextReading() {
        if (!readingBag.length) readingBag = readings.slice().sort(() => Math.random() - 0.5);
        return readingBag.pop();
    }

    // ---------- Sizing ----------
    let size = 0, dpr = 1;
    function resize() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        size = rect.width;
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    // ---------- State ----------
    const start = performance.now();
    let holdStart = null;          // ms, while pressing
    let unwindFrom = 0, unwindStart = null, unwindMs = 450;
    let unwindSpins = true;        // early release unwinds the dial; a completed lock keeps its position
    let rotationBank = 0;          // degrees banked from completed holds
    let gaze = { from: 0, to: 0, start: 0 };
    let nextGazeAt = start + 2500;
    let gazeIndex = 1;
    const gazeHolds = [2.5, 1.8, 1.2, 0.8, 0.5, 0.8, 1.2, 1.8, 2.5, 3.0];

    function holdProgress(t) {
        if (holdStart !== null) return Math.min(1, (t - holdStart) / 1000 / HOLD_SECONDS);
        if (unwindStart !== null) {
            const k = Math.min(1, (t - unwindStart) / unwindMs);
            if (k >= 1) unwindStart = null;
            return unwindFrom * Math.pow(1 - k, 3);
        }
        return 0;
    }
    const spinFor = (p) => p + 3.75 * p * p;   // same curve the app uses

    function slam(phase) {
        // sharp attack, exponential decay
        let t = phase % 1; if (t < 0) t += 1;
        return t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) * 7);
    }

    // ---------- Cymatics sand ----------
    const particles = [];
    let lastPulseFloor = -1;
    function spawn(R, burst, count) {
        for (let i = 0; i < count && particles.length < 240; i++) {
            const a = burst ? (i / count) * TAU + (Math.random() - 0.5) * 0.24 : Math.random() * TAU;
            const speed = burst ? (0.5 + Math.random() * 0.5) : (0.07 + Math.random() * 0.15);
            const tangent = burst ? 0 : (Math.random() - 0.5) * 0.08;
            particles.push({
                r: R + 2 + Math.random() * 4, a,
                vr: speed * R, va: tangent,
                size: 0.6 + Math.random() * 0.8,
                bright: 0.6 + Math.random() * 0.4,
                age: 0
            });
        }
    }
    function stepParticles(dt, R, maxR, p) {
        for (const q of particles) {
            q.r += q.vr * dt;
            q.a += q.va * dt;
            q.vr *= Math.pow(0.8, dt);
            q.vr += (Math.random() - 0.5) * 3 * dt;
            if (q.r < R + 1) { q.r = R + 1; q.vr = Math.abs(q.vr) * 0.6; }
            q.age += dt;
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            if (particles[i].r > maxR) particles.splice(i, 1);
        }
        spawnAcc += dt * (70 + p * 260);
        const n = Math.floor(spawnAcc);
        if (n > 0) { spawnAcc -= n; spawn(R, false, n); }
    }
    let spawnAcc = 0;

    // Pre-fill sand already in flight so the first frame isn't bare (as the app does)
    function prefill() {
        const R = size * 0.33;
        for (let i = 0; i < 90; i++) {
            spawn(R, false, 1);
            const q = particles[particles.length - 1];
            q.r = R + 5 + Math.random() * (size * 0.5 - R - 5);
            q.age = 1;
        }
    }
    if (!reduceMotion) prefill();

    // ---------- Drawing ----------
    function band(cx, cy, outer, inner, alpha) {
        ctx.beginPath();
        ctx.arc(cx, cy, outer, 0, TAU);
        ctx.arc(cx, cy, inner, 0, TAU, true);
        ctx.fillStyle = C.obsidian;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    function ring(cx, cy, r, color, width, alpha) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    function withRing(cx, cy, rotation, scale, brightness, draw) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        if (brightness > 0.01 && "filter" in ctx) ctx.filter = `brightness(${1 + brightness})`;
        draw();
        ctx.restore();
    }

    // Twelve simple day-sign marks (drawn, not the app's font)
    function daySign(i, s) {
        ctx.beginPath();
        switch (i % 6) {
            case 0: // Ollin cross
                ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); break;
            case 1: // stepped fret
                ctx.moveTo(-s, s); ctx.lineTo(-s, 0); ctx.lineTo(0, 0); ctx.lineTo(0, -s); ctx.lineTo(s, -s); break;
            case 2: // spiral wind
                for (let k = 0; k <= 24; k++) {
                    const a = k * 0.5, rr = (k / 24) * s;
                    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
                    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                break;
            case 3: // water waves
                ctx.moveTo(-s, -s * 0.4); ctx.quadraticCurveTo(-s / 2, -s, 0, -s * 0.4); ctx.quadraticCurveTo(s / 2, s * 0.2, s, -s * 0.4);
                ctx.moveTo(-s, s * 0.5); ctx.quadraticCurveTo(-s / 2, -s * 0.1, 0, s * 0.5); ctx.quadraticCurveTo(s / 2, s * 1.1, s, s * 0.5);
                break;
            case 4: // four dots
                for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                    ctx.moveTo(x * s * 0.55 + 1.2, y * s * 0.55); ctx.arc(x * s * 0.55, y * s * 0.55, 1.2, 0, TAU);
                }
                break;
            default: // flint point
                ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0); ctx.closePath();
        }
        ctx.stroke();
    }

    function draw(t) {
        const cx = size / 2, cy = size / 2;
        const R = size * 0.33;                       // stone radius
        const secs = (t - start) / 1000;
        const p = holdProgress(t);
        const spin = (holdStart === null && unwindStart !== null && !unwindSpins) ? 0 : spinFor(p);
        const rot = (reduceMotion ? 0 : secs * 6) + rotationBank + spin * 30;   // degrees
        const pulse = reduceMotion ? 0 : secs * 0.36;
        const twinkle = (i) => reduceMotion ? 1 : 0.7 + 0.3 * Math.sin((secs + i * 0.7) * 2);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        // Warm bloom building under the stone while tuning
        if (p > 0.001) {
            const g = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * (1.5 + p * 0.3));
            g.addColorStop(0, `rgba(255,217,102,${0.32 * p})`);
            g.addColorStop(0.5, `rgba(184,115,51,${0.14 * p})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, size, size);
        }

        // Cymatics sand
        if (!reduceMotion) {
            const floor = Math.floor(pulse);
            if (floor > lastPulseFloor && lastPulseFloor >= 0) spawn(R, true, 40);
            lastPulseFloor = floor;
            const fadeStart = R * 1.2, maxR = size * 0.5;
            for (const q of particles) {
                const x = cx + Math.cos(q.a) * q.r, y = cy + Math.sin(q.a) * q.r;
                const fadeIn = Math.min(1, q.age * 8);
                const fadeOut = q.r > fadeStart ? Math.max(0, 1 - (q.r - fadeStart) / (maxR - fadeStart)) : 1;
                ctx.globalAlpha = 0.6 * fadeIn * fadeOut * q.bright;
                ctx.fillStyle = C.turquoise;
                ctx.beginPath();
                ctx.arc(x, y, q.size, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        const stoneScale = 1 + p * 0.06;

        // Ring 1 — sun rays
        const s0 = slam(pulse);
        withRing(cx, cy, rot * 0.4 * Math.PI / 180, stoneScale * (1 + s0 * 0.025), s0 * 0.35, () => {
            const outer = R, inner = R * 0.79;
            band(0, 0, outer, inner, 0.92);
            for (let i = 0; i < 8; i++) {
                const a = i * TAU / 8, hw = Math.PI / 8 * 0.35, tw = twinkle(i);
                ctx.beginPath();
                ctx.moveTo(Math.cos(a - hw) * inner, Math.sin(a - hw) * inner);
                ctx.lineTo(Math.cos(a) * (outer - 2), Math.sin(a) * (outer - 2));
                ctx.lineTo(Math.cos(a + hw) * inner, Math.sin(a + hw) * inner);
                ctx.closePath();
                ctx.globalAlpha = 0.65 * tw; ctx.fillStyle = C.gold; ctx.fill();
                ctx.globalAlpha = 0.8 * tw; ctx.strokeStyle = C.brightGold; ctx.lineWidth = 0.8; ctx.stroke();
                const ba = a + Math.PI / 8, br = (outer + inner) / 2, bs = R * 0.037;
                ctx.beginPath(); ctx.arc(Math.cos(ba) * br, Math.sin(ba) * br, bs, 0, TAU);
                ctx.globalAlpha = 0.8 * tw; ctx.fillStyle = C.turquoise; ctx.fill();
                ctx.globalAlpha = 0.5; ctx.strokeStyle = C.brightGold; ctx.lineWidth = 0.6; ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ring(0, 0, outer, C.brightGold, 1.5, 0.7);
            ring(0, 0, inner, C.brightGold, 1.5, 0.7);
        });

        // Ring 2 — twelve day-sign cartouches
        const s1 = slam(pulse - 0.15);
        withRing(cx, cy, rot * 0.7 * Math.PI / 180, stoneScale * (1 + s1 * 0.025), s1 * 0.35, () => {
            const outer = R * 0.77, inner = R * 0.46, mid = (outer + inner) / 2, cr = R * 0.1;
            band(0, 0, outer, inner, 0.94);
            ctx.lineCap = "round"; ctx.lineJoin = "round";
            for (let i = 0; i < 12; i++) {
                const a = i * TAU / 12, tw = twinkle(i);
                ctx.save();
                ctx.translate(Math.cos(a) * mid, Math.sin(a) * mid);
                ctx.rotate(-rot * 0.7 * Math.PI / 180);           // glyphs stay upright
                ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU);
                ctx.globalAlpha = 0.35 * tw; ctx.strokeStyle = C.brightGold; ctx.lineWidth = 0.8; ctx.stroke();
                ctx.globalAlpha = 0.9 * tw; ctx.strokeStyle = C.brightGold; ctx.lineWidth = 1.2;
                daySign(i, cr * 0.55);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            ring(0, 0, inner, C.brightGold, 2.5, 0.7);
        });

        // Ring 3 — twenty calendar notches
        const s2 = slam(pulse - 0.3);
        withRing(cx, cy, rot * 1.3 * Math.PI / 180, stoneScale * (1 + s2 * 0.025), s2 * 0.35, () => {
            const outer = R * 0.44, inner = R * 0.29;
            band(0, 0, outer, inner, 0.9);
            for (let i = 0; i < 20; i++) {
                const a = i * TAU / 20, ha = Math.PI / 20 * 0.75, tall = i % 2 === 0, tw = twinkle(i);
                const so = tall ? outer - 1 : outer - R * 0.03, si = tall ? inner + 1 : inner + R * 0.03;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a - ha) * si, Math.sin(a - ha) * si);
                ctx.lineTo(Math.cos(a - ha) * so, Math.sin(a - ha) * so);
                ctx.lineTo(Math.cos(a + ha) * so, Math.sin(a + ha) * so);
                ctx.lineTo(Math.cos(a + ha) * si, Math.sin(a + ha) * si);
                ctx.closePath();
                ctx.globalAlpha = (tall ? 0.55 : 0.35) * tw; ctx.fillStyle = tall ? C.gold : C.copper; ctx.fill();
                ctx.globalAlpha = 0.5 * tw; ctx.strokeStyle = C.brightGold; ctx.lineWidth = 0.8; ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ring(0, 0, outer, C.brightGold, 2, 0.6);
            ring(0, 0, inner, C.brightGold, 2, 0.6);
        });

        // Center — Ollin arms + the eye
        const sc = slam(pulse - 0.45);
        const centerPop = reduceMotion ? 0 : (sc * 0.12);
        withRing(cx, cy, 0, stoneScale * (1 + centerPop), sc * 0.5, () => {
            const face = R * 0.27, glow = 1 + p * 3;
            ctx.beginPath(); ctx.arc(0, 0, face, 0, TAU);
            ctx.fillStyle = C.obsidian; ctx.globalAlpha = 0.95; ctx.fill();
            for (let i = 0; i < 4; i++) {
                const a = Math.PI / 4 + i * Math.PI / 2;
                ctx.save(); ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(face * 0.12, 0);
                ctx.quadraticCurveTo(face * 0.6, -face * 0.42, face * 0.95, 0);
                ctx.quadraticCurveTo(face * 0.6, face * 0.42, face * 0.12, 0);
                ctx.globalAlpha = 0.9; ctx.fillStyle = C.arms[i]; ctx.fill();
                ctx.globalAlpha = 0.7; ctx.strokeStyle = C.brightGold; ctx.lineWidth = 0.8; ctx.stroke();
                ctx.restore();
            }
            ring(0, 0, face, C.brightGold, 2, 0.8);

            // Eye — straight-line saccades between golden-angle gaze points
            const eyeR = face * 0.34;
            ctx.beginPath(); ctx.arc(0, 0, eyeR * 1.8 * glow * 0.35, 0, TAU);
            ctx.globalAlpha = Math.min(0.6, 0.15 * glow); ctx.fillStyle = C.turquoise; ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, TAU);
            ctx.globalAlpha = 0.95; ctx.fillStyle = C.sclera; ctx.fill();
            const k = Math.min(1, Math.max(0, (t - gaze.start) / 550));
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const gx = Math.cos(gaze.from) * (1 - e) + Math.cos(gaze.to) * e;
            const gy = Math.sin(gaze.from) * (1 - e) + Math.sin(gaze.to) * e;
            const off = eyeR * 0.2;
            const ix = gx * off, iy = gy * off, irisR = eyeR * 0.58;
            ctx.beginPath(); ctx.arc(ix, iy, irisR, 0, TAU);
            ctx.globalAlpha = 1; ctx.fillStyle = C.turquoise; ctx.fill();
            ctx.beginPath(); ctx.arc(ix, iy, irisR * (0.48 - p * 0.12), 0, TAU);
            ctx.fillStyle = "rgb(8,6,3)"; ctx.fill();
            ctx.beginPath(); ctx.arc(ix - irisR * 0.3, iy - irisR * 0.3, irisR * 0.16, 0, TAU);
            ctx.globalAlpha = 0.85; ctx.fillStyle = "#fff"; ctx.fill();
            ring(0, 0, eyeR, C.brightGold, 1, 0.7);
            ctx.globalAlpha = 1;
        });

        // Progress arc
        if (p > 0.001) {
            const ar = R * 1.1;
            ctx.save();
            ctx.lineCap = "round";
            ctx.shadowColor = "rgba(255,217,102,0.8)";
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(cx, cy, ar, -Math.PI / 2, -Math.PI / 2 + TAU * p);
            const g = ctx.createLinearGradient(cx - ar, cy - ar, cx + ar, cy + ar);
            g.addColorStop(0, C.copper); g.addColorStop(1, C.glowGold);
            ctx.strokeStyle = g;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }

        return { p, R };
    }

    // ---------- Loop ----------
    let visible = true, rafId = 0, lastFrame = start;
    function frame(t) {
        rafId = 0;
        const dt = Math.min(0.1, (t - lastFrame) / 1000);
        lastFrame = t;

        if (t >= nextGazeAt) {
            const current = currentGazeAngle(t);
            gaze = { from: current, to: gazeIndex * GOLDEN_ANGLE, start: t };
            nextGazeAt = t + gazeHolds[gazeIndex % gazeHolds.length] * 1000;
            gazeIndex++;
        }

        const { p } = drawAndStep(t, dt);
        updateHoldUI(p);

        if (visible && !document.hidden) rafId = requestAnimationFrame(frame);
    }
    function drawAndStep(t, dt) {
        const R = size * 0.33;
        const p = holdProgress(t);
        if (!reduceMotion) stepParticles(dt, R, size * 0.5, p);
        draw(t);
        return { p, R };
    }
    function currentGazeAngle(t) {
        const k = Math.min(1, Math.max(0, (t - gaze.start) / 550));
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        return Math.atan2(
            Math.sin(gaze.from) * (1 - e) + Math.sin(gaze.to) * e,
            Math.cos(gaze.from) * (1 - e) + Math.cos(gaze.to) * e
        );
    }
    function kick() {
        if (!rafId && visible && !document.hidden) {
            lastFrame = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    }
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; kick(); }).observe(canvas);
    }
    document.addEventListener("visibilitychange", kick);
    kick();

    // ---------- Sound ----------
    let soundOn = true;
    try { soundOn = localStorage.getItem("ollinSound") !== "off"; } catch (_) {}
    soundToggle.setAttribute("aria-pressed", String(soundOn));
    soundToggle.addEventListener("click", () => {
        soundOn = !soundOn;
        soundToggle.setAttribute("aria-pressed", String(soundOn));
        try { localStorage.setItem("ollinSound", soundOn ? "on" : "off"); } catch (_) {}
        if (!soundOn) { stopTone(0.1); if ("speechSynthesis" in window) speechSynthesis.cancel(); }
    });

    let audio = null, tone = null;
    function startTone() {
        if (!soundOn) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio = audio || new AC();
        if (audio.state === "suspended") audio.resume();
        const t0 = audio.currentTime;
        const out = audio.createGain();
        out.gain.setValueAtTime(0, t0);
        out.gain.linearRampToValueAtTime(0.07, t0 + 0.15);
        out.gain.linearRampToValueAtTime(0.13, t0 + HOLD_SECONDS);
        out.connect(audio.destination);

        const oscs = [];
        for (const [mult, level] of [[1, 1], [2, 0.25], [3, 0.08]]) {
            const o = audio.createOscillator();
            const g = audio.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(120 * mult, t0);
            o.frequency.exponentialRampToValueAtTime(432 * mult, t0 + HOLD_SECONDS);
            g.gain.value = level;
            o.connect(g).connect(out);
            o.start(t0);
            oscs.push(o);
        }
        // Wobble
        const lfo = audio.createOscillator(), depth = audio.createGain();
        lfo.frequency.value = 5.5; depth.gain.value = 3;
        lfo.connect(depth);
        oscs.forEach((o) => depth.connect(o.frequency));
        lfo.start(t0);
        oscs.push(lfo);
        tone = { out, oscs };
    }
    function stopTone(fade) {
        if (!tone || !audio) return;
        const { out, oscs } = tone;
        const t0 = audio.currentTime;
        out.gain.cancelScheduledValues(t0);
        out.gain.setValueAtTime(out.gain.value, t0);
        out.gain.linearRampToValueAtTime(0, t0 + fade);
        oscs.forEach((o) => o.stop(t0 + fade + 0.05));
        tone = null;
    }
    function lockTone() {
        if (!tone || !audio) return;
        const { out } = tone;
        const t0 = audio.currentTime;
        out.gain.cancelScheduledValues(t0);
        out.gain.setValueAtTime(0.3, t0);
        out.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
        tone.oscs.forEach((o) => o.stop(t0 + 1));
        tone = null;
    }

    let voice = null;
    function pickVoice() {
        if (!("speechSynthesis" in window)) return;
        const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
        const preferred = ["Daniel", "Arthur", "Aaron", "Google UK English Male", "Microsoft Guy", "Alex"];
        voice = preferred.map((n) => voices.find((v) => v.name.includes(n))).find(Boolean) || voices[0] || null;
    }
    if ("speechSynthesis" in window) {
        pickVoice();
        speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
    }
    function speak(text) {
        if (!soundOn || !("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.pitch = 0.55;
        u.rate = 0.86;
        speechSynthesis.speak(u);
    }
    // iOS only allows speech that starts inside a user gesture; prime it on press
    function primeSpeech() {
        if (!soundOn || !("speechSynthesis" in window) || primeSpeech.done) return;
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        speechSynthesis.speak(u);
        primeSpeech.done = true;
    }

    // ---------- Ritual ----------
    const fib = [1000, 618, 382, 236, 146, 90, 56];
    let buzzTimer = 0;
    function buzzSequence(i) {
        if (!navigator.vibrate || holdStart === null || i >= fib.length) return;
        buzzTimer = setTimeout(() => {
            if (holdStart === null) return;
            navigator.vibrate(i < 3 ? 8 : 16);
            buzzSequence(i + 1);
        }, fib[i]);
    }

    let typeTimer = 0;
    function showTransmission(text) {
        clearInterval(typeTimer);
        transmissionEl.classList.add("shown");
        let shown = 0;
        const render = () => {
            transmissionText.textContent = "";
            transmissionText.append(document.createTextNode(text.slice(0, shown)));
            const ghost = document.createElement("span");
            ghost.className = "ghost";
            ghost.textContent = text.slice(shown);
            transmissionText.append(ghost);
        };
        if (reduceMotion) { shown = text.length; render(); return; }
        render();
        typeTimer = setInterval(() => {
            shown++;
            render();
            if (shown >= text.length) clearInterval(typeTimer);
        }, 42);
    }

    let pendingSpeech = null;
    function beginHold(e) {
        if (holdStart !== null) return;
        if (e && e.pointerId !== undefined) canvas.setPointerCapture?.(e.pointerId);
        holdStart = performance.now();
        unwindStart = null;
        panel.classList.add("holding");
        promptEl.textContent = "Tuning…";
        transmissionEl.classList.remove("shown");
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        primeSpeech();
        startTone();
        navigator.vibrate?.(6);
        buzzSequence(0);
        kick();
    }
    function endHold() {
        if (holdStart === null) {
            if (pendingSpeech) { speak(pendingSpeech); pendingSpeech = null; }
            return;
        }
        const p = holdProgress(performance.now());
        holdStart = null;
        clearTimeout(buzzTimer);
        panel.classList.remove("holding");
        if (p < 1) {
            unwindFrom = p;
            unwindStart = performance.now();
            unwindMs = 450;
            unwindSpins = true;
            stopTone(0.25);
            promptEl.textContent = "The signal slipped — hold until it locks";
            hzEl.innerHTML = "&nbsp;";
        }
    }
    function complete() {
        holdStart = null;
        // Bank the wound-up spin so the dial doesn't snap back; let the glow fade under the bloom
        rotationBank += spinFor(1) * 30;
        unwindFrom = 1;
        unwindStart = performance.now();
        unwindMs = 1100;
        unwindSpins = false;
        clearTimeout(buzzTimer);
        panel.classList.remove("holding");
        lockTone();
        navigator.vibrate?.([30, 40, 60]);
        flashEl.classList.remove("flash");
        void flashEl.offsetWidth;
        flashEl.classList.add("flash");
        promptEl.textContent = "Signal locked — hold again for another";
        hzEl.textContent = "432.0 Hz";
        const text = nextReading();
        showTransmission(text);
        // Speak now if allowed; iOS may need the release gesture, so retry on pointerup
        pendingSpeech = text;
        if (!/iP(hone|ad|od)/.test(navigator.userAgent)) { speak(text); pendingSpeech = null; }
    }
    function updateHoldUI(p) {
        meterFill.style.transform = `scaleX(${p})`;
        if (holdStart !== null) {
            hzEl.textContent = (120 + (432 - 120) * p).toFixed(1) + " Hz";
            if (p >= 1) complete();
        }
    }

    canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); beginHold(e); });
    canvas.addEventListener("pointerup", endHold);
    canvas.addEventListener("pointercancel", endHold);
    canvas.addEventListener("lostpointercapture", endHold);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("keydown", (e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); beginHold(); }
    });
    canvas.addEventListener("keyup", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); endHold(); }
    });
    transmissionEl.addEventListener("click", () => {
        window.location.href = "https://apps.apple.com/us/app/the-ollin-tuner/id6759269358";
    });
})();
