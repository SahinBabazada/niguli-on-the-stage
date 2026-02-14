import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function App() {
  const mountRef = useRef(null);

  // ---------- Paths ----------
  const STAGE_URL = "/assets/dancing__singing_stage.glb";
  const CHAR_URL = "/assets/Meshy_AI_Character_output.glb";
  const ANIM_URL = "/assets/Meshy_AI_Meshy_Merged_Animations.glb";
  const APPLAUSE_URL = "/applouse/vvqne-applause-383901.mp3";
  const musicUrl = (file) => `/sounds/${file}`;

  // ---------- UI Visibility State (NEW) ----------
  const [panelOpen, setPanelOpen] = useState(true);

  // ---------- Loading State ----------
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // ---------- Transform UI state ----------
  const [stageT, setStageT] = useState({ x: 0, y: -1.2, z: 0, s: 0.079, r: -1.6 });
  const [charT, setCharT] = useState({ x: 0, y: 0, z: 0, s: 1.0 });
  const [showTransforms, setShowTransforms] = useState(false);

  // ---------- Animation UI state ----------
  const [clipNames, setClipNames] = useState([]);
  const [selectedClip, setSelectedClip] = useState("");
  const selectedClipRef = useRef("");
  const [animStatus, setAnimStatus] = useState("Initializing...");

  // ---------- Applause UI state ----------
  const [isApplauding, setIsApplauding] = useState(false);
  const [particles, setParticles] = useState([]);
  const applauseAudioRef = useRef(null);

  // ---------- Music UI state ----------
  const [musicNames] = useState([
    "9jackjack8-club-vocal-house-343307.mp3",
    "alexgrohl-sad-soul-sad-hip-hop-chasing-a-feeling-185750.mp3",
    "fassounds-lofi-study-calm-peaceful-chill-hop-112191.mp3",
    "giorgiovitte-berry-groovy-bass-trap-476603.mp3",
    "justchilling1991-black-mamba-243827.mp3",
    "looksmusic-120-bpm-__allure__-g-maj_hard-dj-music-mix-2025-435599.mp3",
    "music-for-videos-cheerful-electro-swing-152580.mp3",
    "music-for-videos-donx27t-say-goodbye-funny-electro-swing-song-151282.mp3",
    "music-for-videos-immersing-into-electro-swing-152574.mp3",
    "music-for-videos-swinging-electro-swing-funny-catchy-151280.mp3",
    "nastelbom-action-440170.mp3",
    "nastelbom-fashion-house-321608.mp3",
    "onesevenbeatxs-aggressive-hard-dark-trap-beat-prod-by-onesevenbeatxs-309327.mp3",
    "the__mountain-deep-house-483808.mp3",
    "vaitsez-arabic-drill-trap-beat-482050.mp3",
  ]);
  const [selectedMusic, setSelectedMusic] = useState("nastelbom-fashion-house-321608.mp3");
  const [musicStatus, setMusicStatus] = useState("Music idle");
  const [musicVol, setMusicVol] = useState(0.6);

  // ---------- Three object refs ----------
  const stageRef = useRef(null);
  const playerRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);

  // ---------- Animation engine refs ----------
  const mixerRef = useRef(null);
  const actionsRef = useRef(new Map());
  const currentActionRef = useRef(null);

  // ---------- Audio & Visualizer refs ----------
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const activeAudioRef = useRef("A");
  const fadeTimerRef = useRef(null);
  const pendingMusicRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  // ---------- Responsive Init ----------
  useEffect(() => {
    // If screen is narrow (mobile), start collapsed
    if (window.innerWidth < 768) {
      setPanelOpen(false);
    }
  }, []);

  // ---------- Audio System ----------
  const stopFade = () => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const initAudioSystem = () => {
    if (audioARef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);

    const a = new Audio();
    a.loop = true;
    a.volume = 0;
    a.crossOrigin = "anonymous";
    const sourceA = ctx.createMediaElementSource(a);
    sourceA.connect(analyser);

    const b = new Audio();
    b.loop = true;
    b.volume = 0;
    b.crossOrigin = "anonymous";
    const sourceB = ctx.createMediaElementSource(b);
    sourceB.connect(analyser);

    const app = new Audio(APPLAUSE_URL);
    app.volume = 1.0;
    applauseAudioRef.current = app;

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    audioARef.current = a;
    audioBRef.current = b;
  };

  useEffect(() => {
    const unlock = async () => {
      initAudioSystem();
      try {
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
        audioUnlockedRef.current = true;

        if (pendingMusicRef.current) {
          const { file, targetVolume, ms } = pendingMusicRef.current;
          pendingMusicRef.current = null;
          crossfadeTo(file, targetVolume, ms);
        } else {
          setMusicStatus((s) => (s === "Tap anywhere to enable audio ▶️" ? "Music idle" : s));
        }
      } catch (e) {
        console.warn("Audio unlock failed:", e);
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crossfadeTo = (file, targetVolume = musicVol, ms = 600) => {
    initAudioSystem();

    if (!audioUnlockedRef.current) {
      pendingMusicRef.current = { file, targetVolume, ms };
      setSelectedMusic(file);
      setMusicStatus("Tap anywhere to enable audio ▶️");
      return;
    }

    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    stopFade();

    const next = activeAudioRef.current === "A" ? audioBRef.current : audioARef.current;
    const cur = activeAudioRef.current === "A" ? audioARef.current : audioBRef.current;
    const url = musicUrl(file);

    if (cur.src && cur.src.endsWith(url)) {
      cur.volume = targetVolume;
      setSelectedMusic(file);
      setMusicStatus(`Playing: ${file}`);
      return;
    }

    next.src = url;
    next.currentTime = 0;
    next.loop = true;
    next.volume = 0;

    next
      .play()
      .then(() => {
        setSelectedMusic(file);
        setMusicStatus(`Playing: ${file}`);
        const steps = Math.max(1, Math.floor(ms / 20));
        const dv = targetVolume / steps;
        let i = 0;
        fadeTimerRef.current = setInterval(() => {
          i += 1;
          next.volume = Math.min(targetVolume, next.volume + dv);
          cur.volume = Math.max(0, cur.volume - dv);
          if (i >= steps) {
            stopFade();
            cur.pause();
            cur.currentTime = 0;
            activeAudioRef.current = activeAudioRef.current === "A" ? "B" : "A";
          }
        }, 20);
      })
      .catch((e) => {
        console.warn(e);
        pendingMusicRef.current = { file, targetVolume, ms };
        setMusicStatus("Tap anywhere to enable audio ▶️");
      });
  };

  const mapAnimationToMusic = (clipName) => {
    const n = (clipName || "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_");

    if (n.includes("running") || n.includes("run")) return "nastelbom-action-440170.mp3";
    if (n.includes("walking") || n.includes("walk") || n.includes("confident_walk"))
      return "fassounds-lofi-study-calm-peaceful-chill-hop-112191.mp3";
    if (n.includes("hip_hop")) return "alexgrohl-sad-soul-sad-hip-hop-chasing-a-feeling-185750.mp3";
    if (n.includes("gangnam")) return "9jackjack8-club-vocal-house-343307.mp3";
    if (n.includes("all_night")) return "the__mountain-deep-house-483808.mp3";
    if (n.includes("cardio")) return "looksmusic-120-bpm-__allure__-g-maj_hard-dj-music-mix-2025-435599.mp3";
    if (n.includes("magic") || n.includes("genie")) return "vaitsez-arabic-drill-trap-beat-482050.mp3";
    if (n.includes("funny") || n.includes("bubble") || n.includes("boom"))
      return "music-for-videos-cheerful-electro-swing-152580.mp3";
    if (n.includes("pop") || n.includes("denim") || n.includes("crystal") || n.includes("arm_circle"))
      return "nastelbom-fashion-house-321608.mp3";

    return selectedMusic || musicNames[0];
  };

  const playClip = (name, fade = 0.2) => {
    const mixer = mixerRef.current;
    const actions = actionsRef.current;

    if (!mixer || !actions || !actions.has(name)) {
      console.warn("Cannot play:", name);
      return;
    }

    const next = actions.get(name);
    if (currentActionRef.current && currentActionRef.current !== next) {
      currentActionRef.current.fadeOut(fade);
    }

    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    currentActionRef.current = next;

    setSelectedClip(name);
    selectedClipRef.current = name;

    const mapped = mapAnimationToMusic(name);
    if (mapped) crossfadeTo(mapped);
  };

  const stopAnim = () => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixer.stopAllAction();
    currentActionRef.current = null;
    setMusicStatus((s) => (s.startsWith("Playing:") ? s : "Music idle"));
  };

  const triggerApplause = () => {
    initAudioSystem();
    if (isApplauding) return;

    setIsApplauding(true);
    stopAnim();

    if (audioARef.current) audioARef.current.pause();
    if (audioBRef.current) audioBRef.current.pause();
    setMusicStatus("Music paused (applause)");

    if (applauseAudioRef.current) {
      applauseAudioRef.current.currentTime = 0;
      applauseAudioRef.current.play().catch((e) => console.log("Audio block", e));
    }

    const particleInterval = setInterval(() => {
      const id = Date.now() + Math.random();
      const left = Math.random() * 80 + 10;
      setParticles((prev) => [...prev, { id, left }]);
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, 1500);
    }, 200);

    const resumeClip = selectedClipRef.current;

    setTimeout(() => {
      clearInterval(particleInterval);
      setParticles([]);
      setIsApplauding(false);

      if (resumeClip) {
        playClip(resumeClip);
      } else if (clipNames.length > 0) {
        playClip(clipNames[0]);
      }
    }, 6000);
  };

  const moveCamera = (x, y, z) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const controls = controlsRef.current;
    cam.position.x += x;
    cam.position.y += y;
    cam.position.z += z;
    controls.target.x += x;
    controls.target.y += y;
    controls.target.z += z;
    controls.update();
  };

  const zoomCamera = (amount) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const target = controlsRef.current.target;
    const direction = new THREE.Vector3().subVectors(cam.position, target);
    const dist = direction.length();
    let newDist = dist + amount;
    if (newDist < 2) newDist = 2;
    if (newDist > 12) newDist = 12;
    direction.setLength(newDist);
    cam.position.copy(target).add(direction);
    controlsRef.current.update();
  };

  const logBbox = (label, obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    console.log(`[${label}] bbox center:`, center, "size:", size);
  };

  // ---------- LOAD LOGIC ----------
  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1115);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.01, 5000);
    camera.position.set(0, 2, 7);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2.0;
    controls.maxDistance = 12.0;
    controls.enablePan = true;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f3a, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(6, 10, 6);
    scene.add(dir);

    const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
    scene.add(grid);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const p = (itemsLoaded / itemsTotal) * 100;
      setLoadProgress(Math.round(p));
    };

    const loader = new GLTFLoader(manager);
    const loadGltf = (url) =>
      new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

    const loadAllAssets = async () => {
      try {
        setAnimStatus("Downloading assets...");
        const [stageGltf, charGltf, animGltf] = await Promise.all([loadGltf(STAGE_URL), loadGltf(CHAR_URL), loadGltf(ANIM_URL)]);

        const stage = stageGltf.scene;
        stageRef.current = stage;
        scene.add(stage);
        stage.position.set(stageT.x, stageT.y, stageT.z);
        stage.scale.setScalar(stageT.s);
        stage.rotation.y = stageT.r;

        const player = charGltf.scene;
        playerRef.current = player;
        scene.add(player);
        player.position.set(charT.x, charT.y, charT.z);
        player.scale.setScalar(charT.s);

        const mixer = new THREE.AnimationMixer(player);
        mixerRef.current = mixer;

        const baseClips = charGltf.animations || [];
        const extraClips = animGltf.animations || [];
        const allClips = [...baseClips, ...extraClips];

        if (allClips.length === 0) {
          setAnimStatus("No animations found ⚠️");
        } else {
          const map = new Map();
          allClips.forEach((c) => {
            if (c.name) map.set(c.name, mixer.clipAction(c));
          });
          actionsRef.current = map;

          const names = Array.from(map.keys());
          setClipNames(names);
          setAnimStatus("");

          const preferred =
            names.find((x) => x.toLowerCase().includes("walking")) ||
            names.find((x) => x.toLowerCase().includes("all_night")) ||
            names[0];

          if (preferred) setTimeout(() => playClip(preferred, 0), 100);
        }

        setIsLoading(false);
        controls.target.set(0, 1, 0);
      } catch (err) {
        console.error("Load Error:", err);
        setAnimStatus("Error loading assets. Check console.");
      }
    };

    loadAllAssets();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const delta = clock.getDelta();
      const safeDelta = Math.min(delta, 0.1);
      if (mixerRef.current) mixerRef.current.update(safeDelta);
      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.position.set(stageT.x, stageT.y, stageT.z);
      stageRef.current.scale.setScalar(stageT.s);
      stageRef.current.rotation.y = stageT.r;
    }
  }, [stageT]);
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.position.set(charT.x, charT.y, charT.z);
      playerRef.current.scale.setScalar(charT.s);
    }
  }, [charT]);
  useEffect(() => {
    initAudioSystem();
    const cur = activeAudioRef.current === "A" ? audioARef.current : audioBRef.current;
    if (cur && !cur.paused) cur.volume = musicVol;
  }, [musicVol]);

  const printDefaults = () => {
    console.log("DEFAULT_STAGE =", stageT);
    console.log("DEFAULT_CHAR  =", charT);
    if (stageRef.current) logBbox("STAGE", stageRef.current);
    if (playerRef.current) logBbox("PLAYER", playerRef.current);
    alert("Printed defaults to console");
  };

  const prevClip = () => {
    if (isApplauding) return;
    if (!clipNames.length) return;
    const i = Math.max(0, clipNames.indexOf(selectedClip));
    playClip(clipNames[(i - 1 + clipNames.length) % clipNames.length]);
  };
  const nextClip = () => {
    if (isApplauding) return;
    if (!clipNames.length) return;
    const i = Math.max(0, clipNames.indexOf(selectedClip));
    playClip(clipNames[(i + 1) % clipNames.length]);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            zIndex: 9999,
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "#0f1115",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Loading Assets...</div>
          <div style={{ width: 300, height: 6, background: "#333", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${loadProgress}%`,
                height: "100%",
                background: "#00c6ff",
                transition: "width 0.2s",
              }}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.7 }}>{loadProgress}%</div>
        </div>
      )}

      {/* Floating Particles */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 5,
          overflow: "hidden",
        }}
      >
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              bottom: "-50px",
              fontSize: "4rem",
              animation: "floatUp 1.5s ease-out forwards",
              opacity: 0,
            }}
          >
            👏
          </div>
        ))}
        {isApplauding && (
          <div
            style={{
              position: "absolute",
              bottom: "20%",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)",
              padding: "8px 16px",
              borderRadius: 20,
              color: "#FFD700",
              fontWeight: "bold",
              fontSize: "14px",
              boxShadow: "0 0 10px rgba(0,0,0,0.5)",
              animation: "fadeIn 0.5s ease",
            }}
          >
            Shahin Applause active...
          </div>
        )}
      </div>

      {/* --- COLLAPSED TOGGLE BUTTON --- */}
      {!panelOpen && !isLoading && (
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            position: "fixed",
            top: 15,
            left: 15,
            zIndex: 11,
            padding: "10px 16px",
            background: "rgba(20, 20, 25, 0.75)",
            backdropFilter: "blur(12px)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 30,
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          }}
        >
          <span>⚙️</span> Controls
        </button>
      )}

      {/* --- MAIN PANEL --- */}
      {panelOpen && (
        <div style={hud}>
          {/* Header with Title and Close Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={titleStyle}>Niguli on the stage</div>
            <button
              onClick={() => setPanelOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontSize: "20px",
                cursor: "pointer",
                padding: "0 0 0 10px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <div style={sectionTitle}>Animations</div>
          {!isLoading && animStatus && <div style={smallText}>{animStatus}</div>}

          <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
            <button style={btn} onClick={() => selectedClip && playClip(selectedClip)} disabled={isApplauding}>
              Play
            </button>
            <button style={btn} onClick={stopAnim} disabled={isApplauding}>
              Stop
            </button>
            <button style={btn} onClick={prevClip} disabled={isApplauding}>
              ◀
            </button>
            <button style={btn} onClick={nextClip} disabled={isApplauding}>
              ▶
            </button>
          </div>

          <select style={selectStyle} value={selectedClip} onChange={(e) => playClip(e.target.value)} disabled={!clipNames.length || isApplauding}>
            {!clipNames.length ? <option>Loading...</option> : clipNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>

          <button style={applauseBtnStyle} onClick={triggerApplause} disabled={isApplauding}>
            {isApplauding ? "Applauding..." : "👏 Shahin Applause"}
          </button>

          <div style={{ height: 14 }} />

          <div style={sectionTitle}>Music</div>
          <div style={smallText}>{musicStatus}</div>

          <select style={selectStyle} value={selectedMusic} onChange={(e) => crossfadeTo(e.target.value)}>
            {musicNames.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                Volume: <b>{Math.round(musicVol * 100)}%</b>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={musicVol} onChange={(e) => setMusicVol(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5ff" }} />
            </div>
            <Visualizer analyserRef={analyserRef} />
          </div>

          <div style={{ height: 20 }} />

          <button style={{ ...btn, width: "100%", background: "rgba(255,255,255,0.12)" }} onClick={() => setShowTransforms(!showTransforms)}>
            {showTransforms ? "Hide Transform Settings ▲" : "Show Transform Settings ▼"}
          </button>

          {showTransforms && (
            <div style={{ marginTop: 10, padding: 10, background: "rgba(0,0,0,0.3)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={sectionTitle}>Transforms</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>Stage Transform</div>
              <TransformEditor value={stageT} onChange={setStageT} step={0.1} scaleStep={0.01} hasRotation={true} />
              <div style={{ fontWeight: 800, marginTop: 12 }}>Character Transform</div>
              <TransformEditor value={charT} onChange={setCharT} step={0.1} scaleStep={0.01} />
              <button style={{ ...btn, width: "100%", marginTop: 10 }} onClick={printDefaults}>
                Print defaults to console
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- CAMERA CONTROLS (Bottom Right) --- */}
      <div style={controlsContainerStyle}>
        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, fontWeight: 700 }}>ZOOM</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button style={ctrlBtn} onClick={() => zoomCamera(-1.5)} title="Zoom In">
            +
          </button>
          <button style={ctrlBtn} onClick={() => zoomCamera(1.5)} title="Zoom Out">
            -
          </button>
        </div>

        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, fontWeight: 700 }}>MOVE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 30px)", gap: 4 }}>
          <div />
          <button style={ctrlBtnSmall} onClick={() => moveCamera(0, 0.5, 0)}>
            ▲
          </button>
          <div />
          <button style={ctrlBtnSmall} onClick={() => moveCamera(-0.5, 0, 0)}>
            ◀
          </button>
          <div />
          <button style={ctrlBtnSmall} onClick={() => moveCamera(0.5, 0, 0)}>
            ▶
          </button>
          <div />
          <button style={ctrlBtnSmall} onClick={() => moveCamera(0, -0.5, 0)}>
            ▼
          </button>
          <div />
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          10% { opacity: 1; transform: translateY(-50px) scale(1.2); }
          100% { transform: translateY(-400px) scale(1); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// ---------- Visualizer Component ----------
function Visualizer({ analyserRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let animationId;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const bufferLength = 32;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (!analyserRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 0.8;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const hue = i * 5 + 180;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += canvas.width / bufferLength;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyserRef]);

  return (
    <div style={{ width: 100, height: 40, background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
      <canvas ref={canvasRef} width={100} height={40} />
    </div>
  );
}

// ---------- Small components ----------
function TransformEditor({ value, onChange, step = 0.1, scaleStep = 0.01, hasRotation = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
      <Num label="X" v={value.x} step={step} onChange={(n) => set("x", n)} />
      <Num label="Y" v={value.y} step={step} onChange={(n) => set("y", n)} />
      <Num label="Z" v={value.z} step={step} onChange={(n) => set("z", n)} />
      <Num label="Scale" v={value.s} step={scaleStep} onChange={(n) => set("s", n)} />
      {hasRotation && <Num label="Rotate Y" v={value.r} step={0.1} onChange={(n) => set("r", n)} />}
    </div>
  );
}

function Num({ label, v, step, onChange }) {
  return (
    <label style={{ fontSize: 12, opacity: 0.9 }}>
      {label}
      <input
        type="number"
        value={v}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          marginTop: 6,
          padding: "6px 8px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.15)",
          background: "rgba(0,0,0,.2)",
          color: "#fff",
          outline: "none",
          fontSize: 12,
        }}
      />
    </label>
  );
}

// ---------- Updated Responsive Styles ----------
const hud = {
  position: "fixed",
  top: 14,
  left: 14,
  // Responsive sizing:
  maxWidth: "400px",
  width: "90%", // On mobile this takes 90%
  maxHeight: "85vh", // Prevents taking full vertical height
  overflowY: "auto",
  padding: "20px",
  borderRadius: 20,
  background: "rgba(20, 20, 25, 0.85)", // Slightly darker for better readability
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
  color: "#eee",
  fontFamily: "'Inter', system-ui, sans-serif",
  zIndex: 10,
  // Hide scrollbar but keep functionality
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

const titleStyle = {
  fontSize: 20, // Slightly smaller
  fontWeight: 800,
  marginBottom: 12,
  background: "linear-gradient(90deg, #00c6ff, #0072ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  textShadow: "0 0 20px rgba(0, 198, 255, 0.3)",
};

const sectionTitle = {
  fontWeight: 700,
  marginTop: 14,
  color: "#fff",
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "1px",
  opacity: 0.7,
};

const smallText = { fontSize: 13, opacity: 0.9, marginTop: 2, marginBottom: 8, fontStyle: "italic" };

const btn = {
  flex: 1,
  padding: "10px 0",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.1)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  transition: "all 0.2s",
  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
};

const selectStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.15)",
  background: "rgba(0,0,0,0.3)",
  color: "#fff",
  outline: "none",
  fontSize: 13,
  cursor: "pointer",
};

const applauseBtnStyle = {
  ...btn,
  width: "100%",
  marginTop: 12,
  background: "linear-gradient(90deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
  color: "#333",
  fontWeight: 800,
  border: "none",
  boxShadow: "0 0 15px rgba(255, 154, 158, 0.5)",
  fontSize: 14,
};

const controlsContainerStyle = {
  position: "fixed",
  bottom: 20,
  right: 20,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(10px)",
  padding: 10,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.15)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  zIndex: 10,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  transform: "scale(0.9)", // slightly smaller on mobile
  transformOrigin: "bottom right",
};

const ctrlBtn = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s",
};

const ctrlBtnSmall = {
  ...ctrlBtn,
  width: 30,
  height: 30,
  fontSize: 12,
};