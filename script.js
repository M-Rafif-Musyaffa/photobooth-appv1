document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1.1 LOGIKA MENU MOBILE (Slide & Overlay)
  // ==========================================
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.querySelector(".cute-navbar");
  const overlay = document.getElementById("menu-overlay");

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      overlay.classList.toggle("active");
      menuToggle.textContent = isOpen ? "✕" : "☰";
      menuToggle.classList.toggle("active");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
      menuToggle.textContent = "☰";
      menuToggle.classList.remove("active");
    });

    // Tutup menu otomatis saat user memilih setting
    sidebar.addEventListener("click", (e) => {
      if (
        e.target.matches("button, input, .card-option") &&
        sidebar.classList.contains("open")
      ) {
        // Beri jeda kecil agar klik setting terekam dulu
        setTimeout(() => {
          sidebar.classList.remove("open");
          overlay.classList.remove("active");
          menuToggle.textContent = "☰";
          menuToggle.classList.remove("active");
        }, 300);
      }
    });
  }
  // ==========================================
  // 1. ELEMEN DOM & STATE APLIKASI
  // ==========================================
  const video = document.getElementById("camera-stream");
  const arCanvas = document.getElementById("ar-overlay"); // Canvas AR Live
  const arCtx = arCanvas.getContext("2d");
  const captureBtn = document.getElementById("capture-btn");
  const gallery = document.getElementById("photo-gallery");
  const frameWorkspace = document.getElementById("frame-workspace");
  const generateBtn = document.getElementById("generate-btn");
  const canvas = document.getElementById("render-canvas"); // Canvas Cetak Akhir
  const ctx = canvas.getContext("2d");

  // Elemen Teks, Stiker & Tanggal
  const customTextInput = document.getElementById("custom-text-input");
  const showDateCheck = document.getElementById("show-date-check");
  const stickerBtns = document.querySelectorAll(".add-sticker-btn");

  // Elemen Feedback
  const countdownDisplay = document.getElementById("countdown-display");
  const flashOverlay = document.getElementById("flash-overlay");

  // State Default
  let selectedImageSrc = null;
  let currentRatio = 3 / 4;
  let currentTheme = "scrapbook";
  let photoCount = 3;
  let currentOrientation = "vertical";
  let currentFilter = "none";
  let currentAR = "none"; // State untuk Filter AI
  let slotData = [];
  let isCountingDown = false;

  // ==========================================
  // 2. AUDIO FEEDBACK (Synthesizer Tanpa File)
  // ==========================================
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playSound(type) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "beep") {
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === "shutter") {
      const bufferSize = audioCtx.sampleRate * 0.1;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(
        0.01,
        audioCtx.currentTime + 0.1,
      );
      noise.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start();
    }
  }

  // ==========================================
  // 3. SETUP AI (MEDIAPIPE FACE MESH)
  // ==========================================
  const faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    },
  });

  faceMesh.setOptions({
    maxNumFaces: 1, // Fokus 1 wajah agar performa ringan
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    // Samakan ukuran canvas dengan resolusi asli video
    arCanvas.width = video.videoWidth;
    arCanvas.height = video.videoHeight;
    arCtx.clearRect(0, 0, arCanvas.width, arCanvas.height);

    if (results.multiFaceLandmarks && currentAR !== "none") {
      for (const landmarks of results.multiFaceLandmarks) {
        const w = arCanvas.width;
        const h = arCanvas.height;

        // Hitung lebar wajah untuk skala proporsional AR
        const leftEyeOuter = landmarks[33];
        const rightEyeOuter = landmarks[263];
        // Jarak antar mata sebagai acuan ukuran
        const faceScale = Math.abs(rightEyeOuter.x * w - leftEyeOuter.x * w);
        // Hitung kemiringan wajah (Roll)
        const faceAngle = Math.atan2(
          rightEyeOuter.y - leftEyeOuter.y,
          rightEyeOuter.x - leftEyeOuter.x,
        );

        if (currentAR === "neko") {
          // --- 🐾 FILTER NEKO (KUCING CUTE) ---
          const nose = landmarks[1]; // Titik ujung hidung

          arCtx.save();
          arCtx.translate(nose.x * w, nose.y * h);
          arCtx.rotate(faceAngle); // Ikuti kemiringan kepala

          // 1. Gambar Hidung Kucing (Oval Pink)
          arCtx.fillStyle = "#ff8eaa";
          arCtx.beginPath();
          arCtx.ellipse(
            0,
            0,
            faceScale * 0.15,
            faceScale * 0.1,
            0,
            0,
            Math.PI * 2,
          );
          arCtx.fill();

          // 2. Gambar Kumis Kucing Kiri & Kanan
          arCtx.strokeStyle = "#5c4b51";
          arCtx.lineWidth = faceScale * 0.03; // Ketebalan kumis dinamis
          arCtx.lineCap = "round";

          const whiskerLength = faceScale * 0.6;
          const whiskerOffset = faceScale * 0.2;

          // Kumis Kiri (Karena di-mirror, ini digambar di sebelah kiri kanvas)
          arCtx.beginPath();
          arCtx.moveTo(-whiskerOffset, 0);
          arCtx.lineTo(-whiskerLength, -faceScale * 0.1);
          arCtx.stroke();
          arCtx.beginPath();
          arCtx.moveTo(-whiskerOffset, faceScale * 0.1);
          arCtx.lineTo(-whiskerLength, faceScale * 0.2);
          arCtx.stroke();

          // Kumis Kanan
          arCtx.beginPath();
          arCtx.moveTo(whiskerOffset, 0);
          arCtx.lineTo(whiskerLength, -faceScale * 0.1);
          arCtx.stroke();
          arCtx.beginPath();
          arCtx.moveTo(whiskerOffset, faceScale * 0.1);
          arCtx.lineTo(whiskerLength, faceScale * 0.2);
          arCtx.stroke();

          arCtx.restore();

          // 3. Gambar Telinga Kucing di Dahi
          const leftForehead = landmarks[103];
          const rightForehead = landmarks[332];

          const drawEar = (point, tilt) => {
            arCtx.save();
            arCtx.translate(point.x * w, point.y * h);
            arCtx.rotate(faceAngle + tilt);

            // Telinga Luar
            arCtx.fillStyle = "#ffffff";
            arCtx.beginPath();
            arCtx.moveTo(-faceScale * 0.2, 0);
            arCtx.lineTo(faceScale * 0.2, 0);
            arCtx.lineTo(0, -faceScale * 0.5); // Puncak telinga
            arCtx.closePath();
            arCtx.fill();
            arCtx.strokeStyle = "#ff8eaa";
            arCtx.lineWidth = 3;
            arCtx.stroke();

            // Telinga Dalam (Pink)
            arCtx.fillStyle = "#ffb6c1";
            arCtx.beginPath();
            arCtx.moveTo(-faceScale * 0.1, -faceScale * 0.05);
            arCtx.lineTo(faceScale * 0.1, -faceScale * 0.05);
            arCtx.lineTo(0, -faceScale * 0.4);
            arCtx.closePath();
            arCtx.fill();

            arCtx.restore();
          };

          drawEar(leftForehead, -0.3); // Telinga kiri agak miring keluar
          drawEar(rightForehead, 0.3); // Telinga kanan agak miring keluar
        } else if (currentAR === "glasses") {
          // --- 🕶️ FILTER KACAMATA MODERN (BULAT) ---
          const leftEyeCenter = landmarks[468]; // Titik tengah mata kiri (jika refineLandmarks true)
          const rightEyeCenter = landmarks[473]; // Titik tengah mata kanan

          // Jika titik 468/473 tidak terbaca, gunakan titik 159 & 386
          const lEye = leftEyeCenter || landmarks[159];
          const rEye = rightEyeCenter || landmarks[386];

          const midX = (lEye.x * w + rEye.x * w) / 2;
          const midY = (lEye.y * h + rEye.y * h) / 2;

          arCtx.save();
          arCtx.translate(midX, midY);
          arCtx.rotate(faceAngle);

          const lensRadius = faceScale * 0.35;
          const bridgeWidth = faceScale * 0.2;

          // Kaca Hitam Transparan
          arCtx.fillStyle = "rgba(20, 20, 20, 0.85)";
          arCtx.strokeStyle = "#000000";
          arCtx.lineWidth = faceScale * 0.04;

          // Lensa Kiri
          arCtx.beginPath();
          arCtx.arc(
            -lensRadius - bridgeWidth / 2,
            0,
            lensRadius,
            0,
            Math.PI * 2,
          );
          arCtx.fill();
          arCtx.stroke();

          // Lensa Kanan
          arCtx.beginPath();
          arCtx.arc(
            lensRadius + bridgeWidth / 2,
            0,
            lensRadius,
            0,
            Math.PI * 2,
          );
          arCtx.fill();
          arCtx.stroke();

          // Frame Tengah (Bridge)
          arCtx.beginPath();
          arCtx.moveTo(-(bridgeWidth / 2), 0);
          arCtx.lineTo(bridgeWidth / 2, 0);
          arCtx.stroke();

          // Efek Pantulan Cahaya di Lensa (Detail estetika)
          arCtx.fillStyle = "rgba(255, 255, 255, 0.2)";
          arCtx.beginPath();
          arCtx.arc(
            -lensRadius - bridgeWidth / 2 - lensRadius * 0.2,
            -lensRadius * 0.3,
            lensRadius * 0.3,
            0,
            Math.PI * 2,
          );
          arCtx.fill();
          arCtx.beginPath();
          arCtx.arc(
            lensRadius + bridgeWidth / 2 - lensRadius * 0.2,
            -lensRadius * 0.3,
            lensRadius * 0.3,
            0,
            Math.PI * 2,
          );
          arCtx.fill();

          arCtx.restore();
        } else if (currentAR === "bunny") {
          // --- 🐰 FILTER BUNNY CUTE (KELINCI) ---
          const nose = landmarks[1]; // Titik ujung hidung

          arCtx.save();
          arCtx.translate(nose.x * w, nose.y * h);
          arCtx.rotate(faceAngle);

          // 1. Blush On (Pipi merah muda transparan di bawah mata)
          arCtx.fillStyle = "rgba(255, 142, 170, 0.4)";

          // Pipi Kiri
          arCtx.beginPath();
          arCtx.ellipse(
            -faceScale * 0.35,
            faceScale * 0.1,
            faceScale * 0.2,
            faceScale * 0.1,
            0,
            0,
            Math.PI * 2,
          );
          arCtx.fill();

          // Pipi Kanan
          arCtx.beginPath();
          arCtx.ellipse(
            faceScale * 0.35,
            faceScale * 0.1,
            faceScale * 0.2,
            faceScale * 0.1,
            0,
            0,
            Math.PI * 2,
          );
          arCtx.fill();

          // 2. Hidung Kelinci (Oval Pink Kecil)
          arCtx.fillStyle = "#ffb6c1";
          arCtx.beginPath();
          arCtx.ellipse(
            0,
            0,
            faceScale * 0.12,
            faceScale * 0.08,
            0,
            0,
            Math.PI * 2,
          );
          arCtx.fill();

          arCtx.restore();

          // 3. Gigi Kelinci (Di Bibir Atas)
          const upperLip = landmarks[13]; // Landmark 13 = bagian tengah bibir atas

          arCtx.save();
          arCtx.translate(upperLip.x * w, upperLip.y * h);
          arCtx.rotate(faceAngle);

          arCtx.fillStyle = "#ffffff";
          arCtx.strokeStyle = "rgba(0, 0, 0, 0.3)"; // Garis tepi gigi
          arCtx.lineWidth = 1.5;

          // Gigi Kiri
          arCtx.beginPath();
          arCtx.rect(-faceScale * 0.035, 0, faceScale * 0.03, faceScale * 0.09);
          arCtx.fill();
          arCtx.stroke();

          // Gigi Kanan
          arCtx.beginPath();
          arCtx.rect(faceScale * 0.005, 0, faceScale * 0.03, faceScale * 0.09);
          arCtx.fill();
          arCtx.stroke();

          arCtx.restore(); // <--- Lepas dari patokan bibir

          // 4. Telinga Kelinci (Panjang ke atas)
          const leftForehead = landmarks[103];
          const rightForehead = landmarks[332];

          const drawBunnyEar = (point, tilt) => {
            arCtx.save();
            arCtx.translate(point.x * w, point.y * h);
            arCtx.rotate(faceAngle + tilt);

            // Telinga Luar (Putih dengan border pink)
            arCtx.fillStyle = "#ffffff";
            arCtx.strokeStyle = "#ff8eaa";
            arCtx.lineWidth = 2.5;
            arCtx.beginPath();
            arCtx.ellipse(
              0,
              -faceScale * 0.65,
              faceScale * 0.15,
              faceScale * 0.55,
              0,
              0,
              Math.PI * 2,
            );
            arCtx.fill();
            arCtx.stroke();

            // Telinga Dalam (Pink)
            arCtx.fillStyle = "#ffb6c1";
            arCtx.beginPath();
            arCtx.ellipse(
              0,
              -faceScale * 0.6,
              faceScale * 0.07,
              faceScale * 0.4,
              0,
              0,
              Math.PI * 2,
            );
            arCtx.fill();

            arCtx.restore();
          };

          drawBunnyEar(leftForehead, -0.15); // Telinga kiri miring sedikit
          drawBunnyEar(rightForehead, 0.15); // Telinga kanan miring sedikit
        }
      }
    }
  });

  // ==========================================
  // 4. MULAI KAMERA & LOOPING AI
  // ==========================================
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", () => {
        async function detectFace() {
          await faceMesh.send({ image: video });
          requestAnimationFrame(detectFace);
        }
        detectFace();
      });
    })
    .catch((err) => alert("Izinkan akses kamera ya!"));

  // ==========================================
  // 5. GENERATE SLOT & DRAGGABLE STICKER
  // ==========================================
  function renderSlots() {
    const existingStickers = Array.from(
      frameWorkspace.querySelectorAll(".draggable-sticker"),
    );
    frameWorkspace.innerHTML = "";
    existingStickers.forEach((st) => frameWorkspace.appendChild(st));

    slotData = new Array(photoCount).fill(null);
    frameWorkspace.classList.remove("layout-vertical", "layout-horizontal");
    frameWorkspace.classList.add(`layout-${currentOrientation}`);

    for (let i = 0; i < photoCount; i++) {
      const slot = document.createElement("div");
      slot.classList.add("slot");
      slot.textContent = "Pasang";
      slot.addEventListener("click", () => {
        if (selectedImageSrc) {
          slot.style.opacity = "0";
          setTimeout(() => {
            slot.style.backgroundImage = `url(${selectedImageSrc})`;
            slot.textContent = "";
            slot.classList.add("filled");
            slot.style.opacity = "1";
          }, 100);
          slotData[i] = selectedImageSrc;
        } else alert("Pilih foto di galeri dulu!");
      });
      frameWorkspace.appendChild(slot);
    }
  }
  renderSlots();

  // Logika Drag & Drop Stiker DOM
  // Logika Drag, Resize & Rotate Stiker DOM
  let activeSticker = null;
  let isDragging = false,
    isRotating = false;
  let dragOffsetX = 0,
    dragOffsetY = 0,
    startAngle = 0;

  stickerBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const stickerEl = document.createElement("div");
      stickerEl.className = "draggable-sticker selected";
      stickerEl.textContent = btn.textContent;
      stickerEl.dataset.scale = "1.0";
      stickerEl.dataset.rotation = "0";
      stickerEl.style.left = "50%";
      stickerEl.style.top = "50%";

      // Hapus seleksi stiker lain
      document
        .querySelectorAll(".draggable-sticker")
        .forEach((s) => s.classList.remove("selected"));
      frameWorkspace.appendChild(stickerEl);

      stickerEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        stickerEl.remove();
      });

      stickerEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        activeSticker = stickerEl;

        if (e.shiftKey) {
          isRotating = true;
          const wsRect = frameWorkspace.getBoundingClientRect();
          const centerX =
            wsRect.left +
            (parseFloat(stickerEl.style.left) / 100) * wsRect.width;
          const centerY =
            wsRect.top +
            (parseFloat(stickerEl.style.top) / 100) * wsRect.height;
          startAngle =
            Math.atan2(e.clientY - centerY, e.clientX - centerX) *
              (180 / Math.PI) -
            parseFloat(stickerEl.dataset.rotation);
        } else {
          isDragging = true;
          const rect = stickerEl.getBoundingClientRect();
          dragOffsetX = e.clientX - rect.left - rect.width / 2;
          dragOffsetY = e.clientY - rect.top - rect.height / 2;
        }
      });

      stickerEl.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          let current = parseFloat(stickerEl.dataset.scale);
          let next = Math.max(0.3, Math.min(4.0, current - e.deltaY * 0.005));
          stickerEl.dataset.scale = next.toFixed(2);
          stickerEl.style.fontSize = `${30 * next}px`;
        },
        { passive: false },
      );
    });
  });

  document.addEventListener("mousemove", (e) => {
    if (!activeSticker) return;
    const wsRect = frameWorkspace.getBoundingClientRect();

    if (isDragging) {
      let nx = ((e.clientX - wsRect.left - dragOffsetX) / wsRect.width) * 100;
      let ny = ((e.clientY - wsRect.top - dragOffsetY) / wsRect.height) * 100;
      activeSticker.style.left = `${nx}%`;
      activeSticker.style.top = `${ny}%`;
    } else if (isRotating) {
      const cx =
        wsRect.left +
        (parseFloat(activeSticker.style.left) / 100) * wsRect.width;
      const cy =
        wsRect.top +
        (parseFloat(activeSticker.style.top) / 100) * wsRect.height;
      let newAngle =
        Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) -
        startAngle;
      activeSticker.dataset.rotation = newAngle.toFixed(1);
      activeSticker.style.transform = `translate(-50%, -50%) rotate(${newAngle}deg)`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (activeSticker) {
      isDragging = false;
      isRotating = false;
    }
  });

  // ==========================================
  // 6. EVENT LISTENER UI
  // ==========================================
  document.querySelectorAll(".ratio-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".ratio-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      document.documentElement.style.setProperty(
        "--photo-ratio",
        e.target.getAttribute("data-value"),
      );
      const [w, h] = e.target.getAttribute("data-value").split("/").map(Number);
      currentRatio = w / h;
      renderSlots();
    }),
  );

  document.querySelectorAll(".count-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".count-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      photoCount = parseInt(e.target.getAttribute("data-value"));
      renderSlots();
    }),
  );

  document.querySelectorAll(".orient-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".orient-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentOrientation = e.target.getAttribute("data-value");
      renderSlots();
    }),
  );

  document.querySelectorAll(".card-option").forEach((card) =>
    card.addEventListener("click", (e) => {
      document
        .querySelectorAll(".card-option")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      currentTheme = card.getAttribute("data-value");
      frameWorkspace.className = `frame-strip layout-${currentOrientation} theme-${currentTheme}`;
    }),
  );

  document.querySelectorAll(".filter-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.getAttribute("data-filter");
      video.style.filter = currentFilter;
    }),
  );

  document.querySelectorAll(".ar-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".ar-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentAR = e.target.getAttribute("data-ar");
    }),
  );

  // ==========================================
  // 7. JEPRET FOTO & COUNTDOWN
  // ==========================================
  captureBtn.addEventListener("click", () => {
    if (isCountingDown) return;
    isCountingDown = true;
    audioCtx.resume();

    let count = 3;
    countdownDisplay.style.display = "block";
    countdownDisplay.textContent = count;
    playSound("beep");

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        countdownDisplay.textContent = count;
        playSound("beep");
      } else {
        clearInterval(timer);
        countdownDisplay.style.display = "none";
        takePhoto();
        isCountingDown = false;
      }
    }, 1000);
  });

  function takePhoto() {
    playSound("shutter");
    flashOverlay.classList.remove("animate-flash");
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add("animate-flash");

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const videoRatio = vW / vH;
    let drawW = vW,
      drawH = vH,
      startX = 0,
      startY = 0;
    if (currentRatio > videoRatio) {
      drawH = vW / currentRatio;
      startY = (vH - drawH) / 2;
    } else {
      drawW = vH * currentRatio;
      startX = (vW - drawW) / 2;
    }

    canvas.width = drawW;
    canvas.height = drawH;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // Render Video Kamera + Filter
    ctx.filter = currentFilter;
    ctx.drawImage(video, startX, startY, drawW, drawH, 0, 0, drawW, drawH);

    // Render AR AI Canvas (Tanpa filter warna agar stiker tetap original)
    ctx.filter = "none";
    if (currentAR !== "none") {
      ctx.drawImage(arCanvas, startX, startY, drawW, drawH, 0, 0, drawW, drawH);
    }

    const imgUrl = canvas.toDataURL("image/jpeg", 0.9);
    const imgEl = document.createElement("img");
    imgEl.src = imgUrl;
    imgEl.classList.add("gallery-item");
    imgEl.addEventListener("click", () => {
      document
        .querySelectorAll(".gallery-item")
        .forEach((el) => el.classList.remove("selected"));
      imgEl.classList.add("selected");
      selectedImageSrc = imgUrl;
    });
    gallery.prepend(imgEl);
  }

  // ==========================================
  // 8. RENDER CETAK AKHIR (STIKER & TEXT)
  // ==========================================
  generateBtn.addEventListener("click", () => {
    if (slotData.includes(null)) {
      alert(`Isi semua ${photoCount} slot foto!`);
      return;
    }

    let paddingX = 40,
      paddingTop = 40,
      paddingBottom = 40,
      slotSpacing = 30;
    let bgColor = "#ffffff";

    // Aturan Tema Padding (Ditambah area bawah untuk teks kustom)
    if (currentTheme === "scrapbook") {
      paddingTop = 50;
      paddingBottom = 120;
      paddingX = 45;
    }
    if (currentTheme === "retro-os") {
      bgColor = "#dfdfdf";
      paddingTop = 80;
      paddingBottom = 100;
      paddingX = 30;
    }
    if (currentTheme === "neko") {
      bgColor = "#fff5f2";
      paddingBottom = 150;
      paddingX = 35;
    }
    if (currentTheme === "pixel") {
      bgColor = "#2b2b2b";
      paddingTop = 60;
      paddingBottom = 120;
      paddingX = 40;
    }
    if (currentTheme === "cozy") {
      paddingTop = 50;
      paddingBottom = 120;
      paddingX = 40;
    }
    if (currentTheme === "dots") {
      bgColor = "#fff8f8";
      paddingX = 40;
      paddingBottom = 120;
    }
    if (currentTheme === "film") {
      bgColor = "#1a1a1a";
      if (currentOrientation === "vertical") {
        paddingX = 70;
        paddingBottom = 100;
      } else {
        paddingTop = 70;
        paddingBottom = 120;
        paddingX = 40;
      }
    }
    if (currentTheme === "galaxy") {
      bgColor = "#0f0c29";
      paddingBottom = 130;
      paddingX = 35;
    }
    if (currentTheme === "newspaper") {
      bgColor = "#f4f4f0";
      paddingTop = 100;
      paddingBottom = 120;
      paddingX = 30;
    }
    if (currentTheme === "love") {
      paddingTop = 50;
      paddingBottom = 120;
      paddingX = 40;
    }
    if (currentTheme === "cyberpunk") {
      bgColor = "#0d0221";
      paddingTop = 60;
      paddingBottom = 120;
      paddingX = 40;
    }
    if (currentTheme === "watercolor") {
      bgColor = "#f8f9fa";
      paddingTop = 60;
      paddingBottom = 100;
      paddingX = 45;
    }
    if (currentTheme === "vhs") {
      bgColor = "#111111";
      paddingTop = 50;
      paddingBottom = 120;
      paddingX = 30;
    }
    if (currentTheme === "sakura") {
      bgColor = "#fff0f5";
      paddingTop = 50;
      paddingBottom = 130;
      paddingX = 40;
    }
    if (currentTheme === "cafe") {
      bgColor = "#f5ebe0";
      paddingTop = 60;
      paddingBottom = 130;
      paddingX = 45;
    }
    if (currentTheme === "polaroid") {
      bgColor = "#f8f8f8";
      paddingTop = 40;
      paddingBottom = 140;
      paddingX = 40;
    }
    if (currentTheme === "tropical") {
      bgColor = "#fff8e7";
      paddingTop = 55;
      paddingBottom = 130;
      paddingX = 45;
    }
    if (currentTheme === "wanted") {
      bgColor = "#f4e8d1";
      paddingTop = 180;
      paddingBottom = 130;
      paddingX = 45;
    }

    const photoWidth = 520;
    const photoHeight = photoWidth / currentRatio;

    if (currentOrientation === "vertical") {
      canvas.width = paddingX * 2 + photoWidth;
      canvas.height =
        paddingTop +
        paddingBottom +
        photoHeight * photoCount +
        slotSpacing * (photoCount - 1);
    } else {
      canvas.height = paddingTop + paddingBottom + photoHeight;
      canvas.width =
        paddingX * 2 + photoWidth * photoCount + slotSpacing * (photoCount - 1);
    }

    // Gambar Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- BACKGROUND & POLA TEMA CANVAS ---
    if (currentTheme === "cozy") {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#eaf4e5");
      grad.addColorStop(1, "#f7fceb");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (currentTheme === "galaxy") {
      // PERBAIKAN GALAXY
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#0f0c29");
      grad.addColorStop(0.5, "#302b63");
      grad.addColorStop(1, "#24243e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Gambar ratusan bintang acak!
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 150; i++) {
        ctx.globalAlpha = Math.random(); // Kedipan acak
        ctx.beginPath();
        ctx.arc(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 1.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }
    if (currentTheme === "love") {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#ff9a9e");
      grad.addColorStop(1, "#fecfef");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Gambar background hati samar
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "30px Arial";
      for (let i = 0; i < 30; i++) {
        ctx.fillText(
          "❤️",
          Math.random() * canvas.width,
          Math.random() * canvas.height,
        );
      }
    }
    if (currentTheme === "cyberpunk") {
      // Gambar Grid Neon
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }
    if (currentTheme === "newspaper") {
      // Header Koran (Menyesuaikan rotasi Horizontal/Vertical)
      ctx.fillStyle = "#111111";
      ctx.font = 'bold 50px "Times New Roman", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const headerText =
        currentOrientation === "vertical" ? "THE DAILY POST" : "BREAKING NEWS";
      ctx.fillText(headerText, canvas.width / 2, 20);

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20, 80);
      ctx.lineTo(canvas.width - 20, 80);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 85);
      ctx.lineTo(canvas.width - 20, 85);
      ctx.stroke();
    }
    if (currentTheme === "scrapbook") {
      ctx.strokeStyle = "#e8e8e8";
      ctx.lineWidth = 2;
      for (let i = 0; i < canvas.width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
    }
    if (currentTheme === "retro-os") {
      ctx.fillStyle = "#000080";
      ctx.fillRect(0, 0, canvas.width, 45);
      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 20px "Courier New"';
      ctx.fillText("Photobooth.exe", 15, 30);
      ctx.fillStyle = "#dfdfdf";
      ctx.fillRect(canvas.width - 45, 8, 30, 30);
      ctx.fillStyle = "#000000";
      ctx.fillText("X", canvas.width - 35, 30);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    }
    if (currentTheme === "watercolor") {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#e0c3fc");
      grad.addColorStop(0.5, "#8ec5fc");
      grad.addColorStop(1, "#f5f7fa");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#ffb6c1";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.2, canvas.height * 0.3, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a2d5c6";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.8, canvas.height * 0.6, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
    if (currentTheme === "vhs") {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 2);
      }
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(30, 30, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 16px "Courier New"';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("REC", 45, 22);
    }
    if (currentTheme === "sakura") {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#fff5f8");
      grad.addColorStop(1, "#fce4ec");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffb7c5";
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 5 + 3,
          Math.random() * 3 + 2,
          Math.random() * Math.PI,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    if (currentTheme === "cafe") {
      ctx.fillStyle = "rgba(139, 90, 43, 0.03)";
      for (let i = 0; i < canvas.width; i += 60) {
        for (let j = 0; j < canvas.height; j += 60) {
          ctx.beginPath();
          ctx.arc(i + 15, j + 15, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (currentTheme === "tropical") {
      const sunGrad = ctx.createRadialGradient(
        canvas.width / 2,
        -50,
        0,
        canvas.width / 2,
        100,
        400,
      );
      sunGrad.addColorStop(0, "rgba(255, 200, 100, 0.15)");
      sunGrad.addColorStop(1, "rgba(255, 248, 231, 0)");
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let imagesLoaded = 0;
    slotData.forEach((src, index) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        let drawX = paddingX,
          drawY = paddingTop;
        if (currentOrientation === "vertical")
          drawY = paddingTop + index * (photoHeight + slotSpacing);
        else drawX = paddingX + index * (photoWidth + slotSpacing);

        // Khusus Koran, buat fotonya otomatis hitam putih jadul!
        if (currentTheme === "newspaper")
          ctx.filter = "grayscale(100%) contrast(1.2) sepia(0.2)";

        ctx.drawImage(img, drawX, drawY, photoWidth, photoHeight);

        ctx.filter = "none"; // Reset filter

        // Ornamen Per Foto
        if (currentTheme === "retro-os") {
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 4;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
        }
        if (currentTheme === "pixel") {
          ctx.strokeStyle = "#39ff14";
          ctx.lineWidth = 6;
          ctx.strokeRect(drawX - 3, drawY - 3, photoWidth + 6, photoHeight + 6);
        }
        if (currentTheme === "cozy") {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 10;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
        }
        if (currentTheme === "love") {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 15;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
        }
        if (currentTheme === "newspaper") {
          ctx.strokeStyle = "#111111";
          ctx.lineWidth = 4;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
        }
        if (currentTheme === "cyberpunk") {
          ctx.strokeStyle = "#ff00ff";
          ctx.lineWidth = 6;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
          ctx.strokeStyle = "#00ffff";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            drawX - 5,
            drawY - 5,
            photoWidth + 10,
            photoHeight + 10,
          );
        }
        if (currentTheme === "scrapbook") {
          ctx.fillStyle = "rgba(255, 240, 200, 0.7)";
          ctx.save();
          ctx.translate(drawX, drawY);
          ctx.rotate((-15 * Math.PI) / 180);
          ctx.fillRect(-20, -15, 90, 30);
          ctx.restore();
          ctx.save();
          ctx.translate(drawX + photoWidth, drawY + photoHeight);
          ctx.rotate((-10 * Math.PI) / 180);
          ctx.fillRect(-60, -15, 90, 30);
          ctx.restore();
        }
        if (currentTheme === "watercolor") {
          ctx.shadowColor = "rgba(0,0,0,0.1)";
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 5;
          ctx.shadowOffsetY = 5;
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 4;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
        if (currentTheme === "vhs") {
          ctx.strokeStyle = "#555";
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
          ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
          ctx.fillRect(drawX, drawY + photoHeight * 0.75, photoWidth, 2);
          ctx.fillStyle = "rgba(255, 0, 100, 0.15)";
          ctx.fillRect(
            drawX + 2,
            drawY + photoHeight * 0.25,
            photoWidth - 4,
            2,
          );
        }
        if (currentTheme === "sakura") {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 8;
          ctx.shadowColor = "rgba(216, 27, 96, 0.2)";
          ctx.shadowBlur = 10;
          ctx.strokeRect(drawX, drawY, photoWidth, photoHeight);
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }
        if (currentTheme === "cafe") {
          ctx.strokeStyle = "#d4a373";
          ctx.lineWidth = 3;
          ctx.strokeRect(
            drawX - 5,
            drawY - 5,
            photoWidth + 10,
            photoHeight + 10,
          );

          ctx.font = "20px Georgia";
          ctx.fillStyle = "rgba(139, 90, 43, 0.15)";
          ctx.fillText("☕", drawX + photoWidth - 30, drawY + photoHeight - 10);
        }
        if (currentTheme === "polaroid") {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.15)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 5;
          ctx.fillRect(
            drawX - 15,
            drawY - 15,
            photoWidth + 30,
            photoHeight + 50,
          );
          ctx.shadowColor = "transparent";

          ctx.drawImage(img, drawX, drawY, photoWidth, photoHeight);
        }
        if (currentTheme === "tropical") {
          ctx.strokeStyle = "#a8d5ba";
          ctx.lineWidth = 4;
          ctx.strokeRect(drawX - 3, drawY - 3, photoWidth + 6, photoHeight + 6);

          ctx.fillStyle = "rgba(255, 200, 100, 0.1)";
          ctx.beginPath();
          ctx.moveTo(drawX + photoWidth / 2, drawY - 50);
          ctx.lineTo(drawX - 20, drawY + photoHeight + 20);
          ctx.lineTo(drawX + photoWidth + 20, drawY + photoHeight + 20);
          ctx.closePath();
          ctx.fill();
        }
        if (currentTheme === "wanted") {
          // Garis tepi ganda ala poster buronan
          ctx.strokeStyle = "#4a2e15";
          ctx.lineWidth = 12;
          ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
          ctx.lineWidth = 4;
          ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);

          // Teks WANTED
          ctx.fillStyle = "#4a2e15";
          ctx.font = 'bold 80px "Times New Roman", serif';
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("WANTED", canvas.width / 2, 50);

          // Teks DEAD OR ALIVE
          ctx.font = 'bold 28px "Times New Roman", serif';
          ctx.fillText("DEAD OR ALIVE", canvas.width / 2, 130);
        }

        imagesLoaded++;

        if (imagesLoaded === photoCount) {
          // Logika Drag & Drop Stiker (Mouse + Touch)
          let draggedSticker = null;
          let offsetX = 0,
            offsetY = 0;

          // Fungsi pembantu untuk mendapatkan posisi X/Y (baik mouse maupun sentuhan)
          function getPos(e) {
            return e.touches
              ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
              : { x: e.clientX, y: e.clientY };
          }

          stickerBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
              const stickerEl = document.createElement("div");
              stickerEl.className = "draggable-sticker";
              stickerEl.textContent = btn.textContent;
              stickerEl.style.left = "45%";
              stickerEl.style.top = "45%";

              stickerEl.addEventListener("dblclick", () => stickerEl.remove());

              // Event untuk MULAI geser (Mouse & Touch)
              const startDrag = (e) => {
                e.preventDefault(); // Mencegah scroll layar saat menyentuh stiker
                draggedSticker = stickerEl;
                const pos = getPos(e);
                const rect = stickerEl.getBoundingClientRect();
                offsetX = pos.x - rect.left;
                offsetY = pos.y - rect.top;
                stickerEl.style.zIndex = 100;
                stickerEl.style.cursor = "grabbing";
              };

              stickerEl.addEventListener("mousedown", startDrag);
              stickerEl.addEventListener("touchstart", startDrag, {
                passive: false,
              });

              frameWorkspace.appendChild(stickerEl);
            });
          });

          // Event untuk SEDANG geser
          const moveDrag = (e) => {
            if (!draggedSticker) return;
            e.preventDefault();

            const workspaceRect = frameWorkspace.getBoundingClientRect();
            const pos = getPos(e);

            // Hitung posisi baru relatif terhadap workspace
            let newX = pos.x - workspaceRect.left - offsetX;
            let newY = pos.y - workspaceRect.top - offsetY;

            // Batasi agar tidak keluar bingkai
            const maxW = workspaceRect.width - draggedSticker.clientWidth;
            const maxH = workspaceRect.height - draggedSticker.clientHeight;

            newX = Math.max(0, Math.min(newX, maxW));
            newY = Math.max(0, Math.min(newY, maxH));

            draggedSticker.style.left = `${newX}px`;
            draggedSticker.style.top = `${newY}px`;
          };

          document.addEventListener("mousemove", moveDrag);
          document.addEventListener("touchmove", moveDrag, { passive: false });

          // Event untuk SELESAI geser
          const endDrag = () => {
            if (draggedSticker) {
              draggedSticker.style.zIndex = 50;
              draggedSticker.style.cursor = "grab";
              draggedSticker = null;
            }
          };

          document.addEventListener("mouseup", endDrag);
          document.addEventListener("touchend", endDrag);

          // Cetak Teks Custom & Tanggal
          let footerText = customTextInput.value.trim();

          // 1. CEK TEKS DEFAULT TEMA TERLEBIH DAHULU
          if (!footerText) {
            if (currentTheme === "neko") footerText = "Purr-fect Memories 🐾";
            if (currentTheme === "cafe") footerText = "Coffee & Memories ☕";
            if (currentTheme === "polaroid") footerText = "Captured Moments 📷";
            if (currentTheme === "tropical") footerText = "Summer Vibes 🌴";
            if (currentTheme === "galaxy") footerText = "Star Memories 🌌";
            if (currentTheme === "pixel") footerText = "SCORE: 99999";
            if (currentTheme === "watercolor") footerText = "Art in Every Moment 🎨";
            if (currentTheme === "vhs") footerText = "PLAY ▶ 1998";
            if (currentTheme === "sakura") footerText = "桜の季節 🌸";
            if (currentTheme === "wanted") footerText = "$1,000,000 REWARD";
          }

          // 2. AMBIL TANGGAL (JIKA DICENTANG)
          let dateStr = "";
          if (showDateCheck.checked) {
            dateStr = new Date().toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
          }

          // 3. RENDER TEKS KE CANVAS (Hanya 1x Render)
          if (footerText !== "" || dateStr !== "") {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            let textColor = "#5c4b51";
            let fontStyle = 'bold 28px "Nunito"';

            // -- Kumpulan Tema Font --
            if (currentTheme === "film") textColor = "#ffffff";
            if (currentTheme === "pixel") { textColor = "#39ff14"; fontStyle = 'bold 24px "Courier New"'; }
            if (currentTheme === "retro-os") fontStyle = 'bold 20px "Courier New"';
            if (currentTheme === "galaxy") textColor = "#ffffff";
            if (currentTheme === "newspaper") { textColor = "#111111"; fontStyle = 'bold 30px "Times New Roman"'; }
            if (currentTheme === "cyberpunk") { textColor = "#00ffff"; fontStyle = 'bold 24px "Courier New"'; }
            if (currentTheme === "love") { textColor = "#ffffff"; fontStyle = 'bold 32px "Comic Sans MS", cursive, sans-serif'; }
            if (currentTheme === "watercolor") { textColor = "#4a4a4a"; fontStyle = 'italic 26px "Georgia", serif'; }
            if (currentTheme === "vhs") { textColor = "#00ff00"; fontStyle = 'bold 22px "Courier New", monospace'; }
            if (currentTheme === "sakura") { textColor = "#d81b60"; fontStyle = 'bold 28px "Noto Serif JP", serif'; }
            if (currentTheme === "cafe") { textColor = "#6b4c3b"; fontStyle = 'bold 26px "Georgia", serif'; }
            if (currentTheme === "polaroid") { textColor = "#2c2c2c"; fontStyle = 'bold 22px "Courier New", monospace'; }
            if (currentTheme === "tropical") { textColor = "#e8913a"; fontStyle = 'bold 28px "Nunito", sans-serif'; }
            if (currentTheme === "wanted") { textColor = "#4a2e15"; fontStyle = 'bold 45px "Times New Roman", serif'; }

            ctx.fillStyle = textColor;

            // Hitung Posisi (Y)
            let textY = canvas.height - paddingBottom / 2;
            let dateY = textY;

            // Jika KEDUANYA ADA, pisahkan posisinya atas-bawah
            if (footerText !== "" && dateStr !== "") {
              textY = canvas.height - (paddingBottom / 2) - 15; 
              dateY = canvas.height - (paddingBottom / 2) + 20; 
            }

            // -- EKSEKUSI GAMBAR TEKS UTAMA --
            if (footerText !== "") {
              ctx.font = fontStyle;
              ctx.fillText(footerText, canvas.width / 2, textY);
            }

            // -- EKSEKUSI GAMBAR TANGGAL --
            if (dateStr !== "") {
              ctx.font = fontStyle.replace(/\d+px/, "18px"); 
              ctx.globalAlpha = 0.8; 
              ctx.fillText(dateStr, canvas.width / 2, dateY);
              ctx.globalAlpha = 1.0; 
            }
          }

          // Dekorasi Tema Tambahan
          if (currentTheme === "film") {
            ctx.fillStyle = "#ffffff";
            if (currentOrientation === "vertical") {
              for (let y = 15; y < canvas.height; y += 50) {
                ctx.fillRect(20, y, 25, 25);
                ctx.fillRect(canvas.width - 45, y, 25, 25);
              }
            } else {
              for (let x = 15; x < canvas.width; x += 50) {
                ctx.fillRect(x, 20, 25, 25);
                ctx.fillRect(x, canvas.height - 45, 25, 25);
              }
            }
          }

          if (currentTheme === "neko" || currentTheme === "galaxy") {
            ctx.fillStyle =
              currentTheme === "neko" ? "#ff8baa" : "rgba(255, 139, 170, 0.6)";
            const drawPaw = (x, y, scale) => {
              ctx.beginPath();
              ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(
                x - 24 * scale,
                y - 20 * scale,
                12 * scale,
                0,
                Math.PI * 2,
              );
              ctx.fill();
              ctx.beginPath();
              ctx.arc(
                x - 8 * scale,
                y - 35 * scale,
                12 * scale,
                0,
                Math.PI * 2,
              );
              ctx.fill();
              ctx.beginPath();
              ctx.arc(
                x + 8 * scale,
                y - 35 * scale,
                12 * scale,
                0,
                Math.PI * 2,
              );
              ctx.fill();
              ctx.beginPath();
              ctx.arc(
                x + 24 * scale,
                y - 20 * scale,
                12 * scale,
                0,
                Math.PI * 2,
              );
              ctx.fill();
            };

            if (currentOrientation === "vertical") {
              drawPaw(
                canvas.width / 2 - 80,
                canvas.height - paddingBottom / 2,
                1.2,
              );
              drawPaw(
                canvas.width / 2 + 80,
                canvas.height - paddingBottom / 2 - 15,
                0.9,
              );
            } else {
              drawPaw(
                canvas.width - 80,
                canvas.height - paddingBottom / 2,
                1.2,
              );
            }
          }

          if (currentTheme === "dots") {
            ctx.fillStyle = "#ffb6c1";
            if (currentOrientation === "vertical") {
              for (let y = 20; y < canvas.height; y += 45) {
                ctx.beginPath();
                ctx.arc(20, y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(canvas.width - 20, y, 6, 0, Math.PI * 2);
                ctx.fill();
              }
            } else {
              for (let x = 20; x < canvas.width; x += 45) {
                ctx.beginPath();
                ctx.arc(x, 20, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, canvas.height - 20, 6, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // Trigger Download
          const finalLink = document.createElement("a");
          finalLink.download = `nekobooth-${Date.now()}.png`;
          finalLink.href = canvas.toDataURL("image/png", 1.0);
          finalLink.click();
        }
      };
    });
  });
});
