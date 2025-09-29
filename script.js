// script.js — Fixed single-file script
// - preserves original UI + behavior
// - injects always-visible 250-row table (seq_id, Sequence) under Analysis pipeline
// - uses final CSV data (makeCSV) or uploaded CSV (if contains seq_id & Sequence)
// - no other UI or flow changes

// NOTE: keep this file as a full replacement of your old script.js

(function () {
  'use strict';
  
  console.log('eDNA Script Loading...');

  /* -------------------------
     Dummy data / config
     ------------------------- */
  const DUMMY = {
    overview: { dnaCount: '789,245', taxaDetected: '1,830', novelGroups: '62' },
    diversity: { shannon: '5.12', simpson: '0.983', richness: '740' },
    species: [
      'Thunnus albacares',           // Yellowfin tuna
'Katsuwonus pelamis',          // Skipjack tuna
'Gadus morhua',                // Atlantic cod
'Clupea harengus',             // Atlantic herring
'Engraulis encrasicolus',      // European anchovy
'Sardinella longiceps',        // Indian oil sardine
'Salmo salar',                 // Atlantic salmon
'Oncorhynchus mykiss',         // Rainbow trout
'Hippoglossus hippoglossus',   // Atlantic halibut
'Seriola quinqueradiata',      // Japanese amberjack
'Dicentrarchus labrax',        // European seabass
'Sparus aurata',               // Gilthead seabream
'Scomber scombrus',            // Atlantic mackerel
'Trachurus trachurus',         // Atlantic horse mackerel
'Xiphias gladius',             // Swordfish
'Istiophorus platypterus',     // Indo-Pacific sailfish
'Makaira nigricans',           // Blue marlin
'Carcharodon carcharias',      // Great white shark
'Cetorhinus maximus',          // Basking shark
'Prionace glauca',             // Blue shark
'Rhincodon typus',             // Whale shark
'Manta birostris',             // Giant manta ray
'Mobula mobular',              // Devil fish (ray)
'Raja clavata',                // Thornback ray
'Octopus vulgaris',            // Common octopus
'Sepia officinalis',           // Common cuttlefish
'Loligo vulgaris',             // European squid
'Dosidicus gigas',             // Humboldt squid
'Haliotis midae',              // Abalone
'Mytilus edulis',              // Blue mussel
'Crassostrea gigas',           // Pacific oyster
'Pinctada margaritifera',      // Black-lip pearl oyster
'Penaeus monodon',             // Giant tiger prawn
'Litopenaeus vannamei',        // Whiteleg shrimp
'Pandalus borealis',           // Northern prawn
'Carcinus maenas',             // European green crab
'Portunus trituberculatus',    // Japanese blue crab
'Callinectes sapidus',         // Atlantic blue crab
'Macrobrachium rosenbergii',   // Giant freshwater prawn
'Acanthaster planci',          // Crown-of-thorns starfish
'Asterias rubens',             // Common starfish
'Paracentrotus lividus',       // Purple sea urchin
'Strongylocentrotus purpuratus', // Red sea urchin
'Holothuria edulis',           // Edible sea cucumber
'Aurelia aurita',              // Moon jellyfish
'Chrysaora quinquecirrha',     // Sea nettle jellyfish
'Cyanea capillata',            // Lion’s mane jellyfish
'Pelagia noctiluca',           // Mauve stinger jellyfish
'Physalia physalis'            // Portuguese man o’ war

    ],
    clusters: [
      { id:'Cluster_0', seq:34, reads:2350 },
      { id:'Cluster_1', seq:18, reads:1120 },
      { id:'Cluster_2', seq:9, reads:420 },
    ],
    abundance: [
      { Taxonomy:'Bacteroides fragilis', Read_Count: 12000 },
      { Taxonomy:'Prevotella copri', Read_Count: 9800 },
      { Taxonomy:'Faecalibacterium prausnitzii', Read_Count: 6400 },
      { Taxonomy:'Ruminococcus bromii', Read_Count: 4200 },
      { Taxonomy:'Akkermansia muciniphila', Read_Count: 3100 },
    ]
  };

  const PIPE_STEPS = [
    { id:'ingest', title:'Data Ingestion', icon:'fas fa-database', duration:1200 },
    { id:'kmer', title:'K-mer Conversion', icon:'fas fa-code', duration:900 },
    { id:'embed', title:'Embedding (BERT)', icon:'fas fa-brain', duration:1400 },
    { id:'inference', title:'Model Inference', icon:'fas fa-vial', duration:1300 },
    { id:'cluster', title:'Clustering (HDBSCAN)', icon:'fas fa-cubes', duration:1100 },
    { id:'diversity', title:'Diversity Metrics', icon:'fas fa-chart-line', duration:800 },
    { id:'annotation', title:'Taxonomic Annotation', icon:'fas fa-tag', duration:700 }
  ];

  /* -------------------------
     Sequence CSV generator (makeCSV) + helpers
     ------------------------- */
  /* -------------------------
   Marine demo taxa / locations
   ------------------------- */
const SPECIES = [
  'Thunnus albacares',          // Yellowfin tuna
  'Gadus morhua',               // Atlantic cod
  'Clupea harengus',            // Atlantic herring
  'Sardinella longiceps',       // Sardine-like
  'Engraulis encrasicolus',     // European anchovy
  'Haliotis midae',             // abalone (mollusc)
  'Pandalus borealis',          // cold-water shrimp
  'Carcinus maenas',            // green crab
  'Acanthaster planci',         // crown-of-thorns starfish
  'Mytilus edulis',             // blue mussel
  'Noctiluca scintillans',      // marine protist (dinoflagellate)
  'Diatom_sp',                  // generic diatom group
  'Synechococcus sp',           // marine cyanobacteria
  'Pelagia noctiluca',          // jellyfish
  'Euphausia superba',          // krill
  'Aurelia aurita',             // moon jelly
  'Cetorhinus maximus',         // basking shark (example)
  'Lophius piscatorius',        // anglerfish (example)
  'Asterias rubens'             // starfish
];

const MARKERS = ['COI','18S']; // include 16S for microbial marine amplicons

const SOURCES = ['NCBI','BLAST','SILVA'];

const LOCATIONS = [
  'Shelf_A','Slope_B','Seamount_C','Trench_D','Estuary_E',
  'Coastal_F','Offshore_G','Hydrothermal_Vent_H'
];

const TAX_LEVELS = ['species','genus','family','order','phylum'];


  function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function randFloat(min,max,dec=4){ return (Math.random()*(max-min)+min).toFixed(dec); }
  function randSeq(len=60){
    const bases = ['A','T','C','G'];
    let s = '';
    for(let i=0;i<len;i++) s += randChoice(bases);
    return s;
  }

  function makeCSV(rowsCount = 250) {
    const header = [
  'seq_id','Sequence','Marker','Taxonomy','Source','Sample_ID','Read_Count',
  'Taxonomic_Level','Confidence_Score','Location','Depth_m','Latitude','Longitude','Salinity_PSU','kmer_sequence',
  'pred_1','pred_1_conf','pred_2','pred_2_conf','pred_3','pred_3_conf',
  'umap_x','umap_y'
];


    const rows = [];
    for(let i=0;i<rowsCount;i++){
      const seqId = (Math.random()>0.5?'COI':'18S') + '_' + String(randInt(1000,99999)).padStart(5,'0');
      const sequence = randSeq(80);
      const marker = randChoice(MARKERS);
      const taxonomy = randChoice(SPECIES);
      const source = randChoice(SOURCES);
      const sample = randChoice(LOCATIONS);
      const readCount = randInt(1,300);
      const taxLevel = randChoice(TAX_LEVELS);
      const confScore = (Math.random()>0.3) ? randFloat(0.70,0.99,2) : taxLevel;
      const location = sample;
      const depth = (Math.random() > 0.2) ? randInt(10,6000) : '';
      const kmerSeq = randSeq(60);

      const pred1 = 'LABEL_' + randInt(0,40);
      const pred1c = randFloat(0.07,0.20,4);
      const pred2 = 'LABEL_' + randInt(0,40);
      const pred2c = randFloat(0.07,0.20,4);
      const pred3 = 'LABEL_' + randInt(0,40);
      const pred3c = randFloat(0.07,0.20,4);

      const umapX = randFloat(-25,25,4);
      const umapY = randFloat(-25,25,4);

      const lat = (Math.random() * (25) + (-45)).toFixed(6);   // -45 .. -20 .. 25 (broad ocean range)
const lon = (Math.random() * 360 - 180).toFixed(6);      // -180..180
const sal = (Math.random() * 5 + 30).toFixed(2);        // 30..35 PSU typical ocean salinities

rows.push([
  seqId, sequence, marker, taxonomy, source, sample, readCount,
  taxLevel, confScore, location, depth, lat, lon, sal, kmerSeq,
  pred1, pred1c, pred2, pred2c, pred3, pred3c, umapX, umapY
]);

    }

    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    return csv;
  }

  function downloadCSV(filename, csvString) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'report.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* -------------------------
     DOM refs
     ------------------------- */
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.nav-link');

  const fileInput = document.getElementById('dna-file-upload');
  const browseBtn = document.getElementById('browse-btn');
  const dropzone = document.getElementById('dropzone');
  const fileList = document.getElementById('file-list');
  const startAnalysisBtn = document.getElementById('start-analysis-btn');
  const fastSimBtn = document.getElementById('fast-sim');
  const clearFilesBtn = document.getElementById('clear-files');

  // Debug DOM elements
  console.log('DOM Elements Found:', {
    startAnalysisBtn: !!startAnalysisBtn,
    fastSimBtn: !!fastSimBtn,
    fileInput: !!fileInput,
    dropzone: !!dropzone,
    fileList: !!fileList
  });

  const pipelineContainer = document.getElementById('pipeline-container');
  const progressText = document.getElementById('progress-text');
  const globalProgressFill = document.getElementById('global-progress-fill');
  const btnPause = document.getElementById('btn-pause');
  const btnCancel = document.getElementById('btn-cancel');
  const btnToResults = document.getElementById('btn-to-results');

  const metricDna = document.getElementById('metric-dna-count');
  const metricTaxa = document.getElementById('metric-taxa-detected');
  const metricNovel = document.getElementById('metric-novel-groups');
  const metricShannon = document.getElementById('metric-shannon');
  const metricSimpson = document.getElementById('metric-simpson');
  const metricRichness = document.getElementById('metric-richness');
  const speciesListEl = document.getElementById('species-list');
  const clusterGrid = document.getElementById('novel-clusters');
  const abundanceChartEl = document.getElementById('abundance-chart');
  const umapPlotEl = document.getElementById('umap-plot');
  const downloadFilterBtn = document.getElementById('download-filter');
  const filterInput = document.getElementById('filter-q');
  const downloadFinalBtn = document.getElementById('download-final');
  const themeToggle = document.getElementById('theme-toggle');
  const statSamples = document.getElementById('stat-samples');

  /* -------------------------
     Navigation helpers
     ------------------------- */
  function navigate(pageId) {
    console.log('Navigating to:', pageId);
    if (pages) {
      pages.forEach(page => page.classList.remove('active'));
    }
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.classList.add('active');
    } else {
      console.error('Target page not found:', pageId);
    }

    if (navLinks) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageId) link.classList.add('active');
      });
    }

    // scroll to top for page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Make navigate function globally accessible for inline onclick handlers
  window.navigate = navigate;

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const page = link.getAttribute('data-page');
      if (page) navigate(page);
    });
  });

  // clickable logos navigation if present
  const clickableLogo = document.querySelector('.clickable-logo');
  if (clickableLogo) {
    clickableLogo.addEventListener('click', () => navigate('home-page'));
  }

  /* -------------------------
     Tabs
     ------------------------- */
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const t = btn.getAttribute('data-tab');
        const panel = document.getElementById('tab-' + t);
        if (panel) panel.classList.add('active');
      });
    });
  }

  /* -------------------------
     Theme toggle
     ------------------------- */
  function setTheme(isLight) {
    document.body.classList.toggle('light', isLight);
    if (themeToggle) themeToggle.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    // re-render charts if visible
    if (abundanceChartEl && abundanceChartEl.data) renderAbundanceChart();
    if (umapPlotEl && umapPlotEl.data) renderUMAPAnimation();
  }
  // initialize theme
  setTheme(false);
  if (themeToggle) themeToggle.addEventListener('click', () => setTheme(!document.body.classList.contains('light')));

  /* -------------------------
     File upload UI
     ------------------------- */
  let uploadedFiles = []; // File objects array

  function renderFileList() {
    if (fileList) fileList.innerHTML = '';
    if (!uploadedFiles || uploadedFiles.length === 0) {
      if (fileList) fileList.innerHTML = '<p class="muted">No files selected.</p>';
      if (startAnalysisBtn) startAnalysisBtn.disabled = true;
      if (statSamples) statSamples.textContent = '0';
      return;
    }
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    uploadedFiles.forEach((f, i) => {
      const li = document.createElement('li');
      li.style.padding = '8px';
      li.style.marginBottom = '8px';
      li.style.borderRadius = '8px';
      li.style.background = 'rgba(255,255,255,0.02)';
      li.innerHTML = `<strong>${f.name}</strong> <small class="muted">(${(f.size/1024/1024).toFixed(2)} MB)</small>
        <button class="btn ghost remove-file" data-idx="${i}" style="margin-left:12px">Remove</button>`;
      ul.appendChild(li);
    });
    if (fileList) fileList.appendChild(ul);
    if (startAnalysisBtn) startAnalysisBtn.disabled = false;
    if (statSamples) statSamples.textContent = String(uploadedFiles.length);

    if (fileList) {
      fileList.querySelectorAll('.remove-file').forEach(b => {
        b.addEventListener('click', () => {
          const idx = Number(b.getAttribute('data-idx'));
          uploadedFiles.splice(idx, 1);
          // if user removed CSV that was used for preview, refresh preview
          renderFileList();
          renderSeqIdTable(250); // update seq table source
        });
      });
    }
  }

  // wire upload controls
  if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', (e) => {
    uploadedFiles = Array.from(e.target.files || []);
    renderFileList();
    // update seq table preview immediately
    setTimeout(() => renderSeqIdTable(250), 120);
  });

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); dropzone.classList.remove('dragover');
      uploadedFiles = Array.from(e.dataTransfer.files || []);
      renderFileList();
      setTimeout(() => renderSeqIdTable(250), 120);
    });
  }

  if (clearFilesBtn) clearFilesBtn.addEventListener('click', () => {
    uploadedFiles = []; if (fileInput) fileInput.value = ''; renderFileList(); renderSeqIdTable(250);
  });

  if (fastSimBtn) fastSimBtn.addEventListener('click', () => {
    console.log('Demo button clicked');
    uploadedFiles = [{ name: 'demo_sample.fastq', size: 1500000 }];
    renderFileList();
    setTimeout(() => startAnalysisBtn.click(), 250);
  });

  /* -------------------------
     Build pipeline UI
     ------------------------- */
  function buildPipelineUI() {
    if (!pipelineContainer) return;
    pipelineContainer.innerHTML = '';
    PIPE_STEPS.forEach(s => {
      const div = document.createElement('div');
      div.className = 'step';
      div.id = 'step-' + s.id;
      div.innerHTML = `
        <div class="icon"><i class="${s.icon}"></i></div>
        <div class="title">${s.title}</div>
        <div class="status" id="status-${s.id}">Pending</div>
      `;
      pipelineContainer.appendChild(div);
    });
  }
  buildPipelineUI();

  /* -------------------------
     Pipeline simulation engine (supports pause/cancel)
     ------------------------- */
  let simState = { running:false, paused:false, cancelled:false };

  function resetPipelineUI() {
    if (globalProgressFill) globalProgressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Waiting to start...';
    if (btnPause) btnPause.disabled = true;
    if (btnCancel) btnCancel.disabled = true;
    if (btnToResults) btnToResults.disabled = true;

    simState = { running:false, paused:false, cancelled:false };
    PIPE_STEPS.forEach(s => {
      const el = document.getElementById('step-' + s.id);
      if (el) {
        el.classList.remove('active','complete');
        const status = document.getElementById('status-' + s.id);
        if (status) status.textContent = 'Pending';
        const icon = el.querySelector('.icon i');
        if (icon) icon.className = s.icon;
      }
    });
    // remove any preview created earlier (we recreate seq table separately)
    const existing = document.getElementById('csv-preview-container-analysis');
    if (existing) existing.remove();
  }

  resetPipelineUI();

  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));

  async function runPipeline() {
    if (simState.running) return;
    simState.running = true; simState.cancelled = false; simState.paused = false;
    if (btnPause) btnPause.disabled = false; if (btnCancel) btnCancel.disabled = false; if (btnToResults) btnToResults.disabled = true;
    if (globalProgressFill) globalProgressFill.style.width = '0%';

    for (let idx = 0; idx < PIPE_STEPS.length; idx++) {
      if (simState.cancelled) break;

      const step = PIPE_STEPS[idx];
      const el = document.getElementById('step-' + step.id);
      if (!el) continue;
      el.classList.add('active');
      const statusEl = document.getElementById('status-' + step.id);
      const iconEl = el.querySelector('.icon i');
      if (iconEl) iconEl.className = 'fas fa-spinner fa-spin';
      if (statusEl) statusEl.textContent = 'Processing...';

      const start = performance.now();
      let pausedAccum = 0;
      let pauseStart = null;

      while (true) {
        if (simState.cancelled) {
          if (statusEl) statusEl.textContent = 'Cancelled';
          el.classList.remove('active');
          return;
        }
        if (simState.paused) {
          if (!pauseStart) pauseStart = performance.now();
          await raf();
          continue;
        } else if (pauseStart) {
          pausedAccum += performance.now() - pauseStart;
          pauseStart = null;
        }

        const now = performance.now();
        const elapsed = now - start - pausedAccum;
        const pctStep = Math.min(1, elapsed / step.duration);
        const globalPct = Math.round(((idx + pctStep) / PIPE_STEPS.length) * 100);
        if (globalProgressFill) globalProgressFill.style.width = `${globalPct}%`;
        if (progressText) progressText.textContent = `${step.title} — ${Math.round(pctStep * 100)}%`;

        if (pctStep >= 1) {
          el.classList.remove('active'); el.classList.add('complete');
          if (iconEl) iconEl.className = 'fas fa-check-circle';
          if (statusEl) statusEl.textContent = 'Complete';
          break;
        }
        await raf();
      }
      await new Promise(r => setTimeout(r, 280));
    }

    if (!simState.cancelled) {
      if (globalProgressFill) globalProgressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Analysis complete — results ready.';
      if (btnToResults) btnToResults.disabled = false;
      if (btnPause) btnPause.disabled = true; if (btnCancel) btnCancel.disabled = true;
      simState.running = false;

      // Render input data preview + seq table from final CSV
      // renderInputDataPreview(250); // optional separate preview
      renderSeqIdTable(250);
    } else {
      resetPipelineUI();
    }
  }

  // pipeline controls wiring
  if (startAnalysisBtn) {
    startAnalysisBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Start Analysis clicked', { uploadedFiles, length: uploadedFiles?.length });
      
      if (!uploadedFiles || uploadedFiles.length === 0) {
        alert('Please upload at least one file (or use Demo Data).');
        return;
      }
      
      try {
        buildPipelineUI();
        resetPipelineUI();
        runPipeline();
        navigate('analysis-page');
      } catch (error) {
        console.error('Error starting analysis:', error);
        alert('Error starting analysis. Please check the console for details.');
      }
    });
  }

  if (btnPause) btnPause.addEventListener('click', () => {
    if (!simState.running) return;
    simState.paused = !simState.paused;
    btnPause.textContent = simState.paused ? 'Resume' : 'Pause';
    if (progressText) progressText.textContent = simState.paused ? 'Paused' : progressText.textContent;
  });

  if (btnCancel) btnCancel.addEventListener('click', () => {
    if (!simState.running) return;
    simState.cancelled = true;
    resetPipelineUI();
  });

  if (btnToResults) btnToResults.addEventListener('click', () => {
    populateResults();
    navigate('results-page');
    setTimeout(() => setupTabs(), 100);
  });

  /* -------------------------
     Results population + charts
     ------------------------- */
  function populateResults() {
    if (metricDna) metricDna.textContent = DUMMY.overview.dnaCount;
    if (metricTaxa) metricTaxa.textContent = DUMMY.overview.taxaDetected;
    if (metricNovel) metricNovel.textContent = DUMMY.overview.novelGroups;

    if (metricShannon) metricShannon.textContent = DUMMY.diversity.shannon;
    if (metricSimpson) metricSimpson.textContent = DUMMY.diversity.simpson;
    if (metricRichness) metricRichness.textContent = DUMMY.diversity.richness;

    if (speciesListEl) speciesListEl.innerHTML = DUMMY.species.map(s => `<li>${s}</li>`).join('');

    if (clusterGrid) clusterGrid.innerHTML = DUMMY.clusters.map(c => `<div class="cluster"><strong>${c.id}</strong><div class="muted">${c.seq} seqs · ${c.reads} reads</div></div>`).join('');

    if (typeof renderAbundanceChart === 'function') renderAbundanceChart();
    if (typeof renderUMAPAnimation === 'function') renderUMAPAnimation();

    if (typeof renderDiversityWidgets === 'function') renderDiversityWidgets();
  }

  function renderAbundanceChart() {
    if (!abundanceChartEl) return;
    const y = DUMMY.abundance.map(r => r.Taxonomy);
    const x = DUMMY.abundance.map(r => r.Read_Count);

    const isLightMode = document.body.classList.contains('light');
    const textColor = isLightMode ? '#0b1220' : '#ffffff';
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    const zerolineColor = isLightMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';

    const data = [{
      x,
      y,
      type:'bar',
      orientation: 'h',
      marker:{ color: 'rgba(139,99,255,0.9)' }
    }];

    const layout = {
      margin:{t:30,l:220,r:40,b:60},
      xaxis:{
        title: { text: 'Read count', font: { color: textColor, size: 14 } },
        tickfont: { color: textColor, size: 12 },
        gridcolor: gridColor,
        zerolinecolor: zerolineColor
      },
      yaxis:{
        tickfont: { color: textColor, size: 11 },
        gridcolor: gridColor,
        zerolinecolor: zerolineColor,
        automargin: true,
        categoryorder: 'total ascending'
      },
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'rgba(0,0,0,0)',
      font: { color: textColor },
      hoverlabel: {
        bgcolor: isLightMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
        font: { color: textColor }
      }
    };
    Plotly.newPlot(abundanceChartEl, data, layout, {responsive:true});
  }

  let umapInterval = null;
  function renderUMAPAnimation() {
    if (!umapPlotEl) return;
    const clusters = DUMMY.clusters;
    const points = [];
    clusters.forEach((c, idx) => {
      const centerX = (idx - 1) * 3.5;
      const centerY = (idx % 2 === 0) ? 0 : 2.2;
      for(let i=0;i<Math.max(8, c.seq); i++){
        points.push({
          cluster: c.id,
          x: centerX + (Math.random()-0.5) * 1.4,
          y: centerY + (Math.random()-0.5) * 1.0
        });
      }
    });

    const colors = ['#8b63ff','#c7b9ff','#6ec3b8'];
    const traces = [];
    const clusterKeys = [...new Set(points.map(p => p.cluster))];
    clusterKeys.forEach((key, i) => {
      const pts = points.filter(p => p.cluster === key);
      traces.push({
        x: pts.map(p=>p.x),
        y: pts.map(p=>p.y),
        mode:'markers',
        type:'scatter',
        name:key,
        marker:{size:8, color:colors[i % colors.length], opacity:0.9}
      });
    });

    const isLightMode = document.body.classList.contains('light');
    const textColor = isLightMode ? '#0b1220' : '#ffffff';
    const legendBg = isLightMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.3)';
    const legendBorder = isLightMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)';

    const layout = {
      margin:{t:30,l:20,r:20,b:20},
      xaxis:{visible:false},
      yaxis:{visible:false, scaleanchor:'x', scaleratio:1},
      legend:{
        orientation:'h',
        font: { color: textColor, size: 12 },
        bgcolor: legendBg,
        bordercolor: legendBorder,
        borderwidth: 1
      },
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor:'rgba(0,0,0,0)',
      font: { color: textColor }
    };

    Plotly.newPlot(umapPlotEl, traces, layout, {responsive:true});

    if (umapInterval) clearInterval(umapInterval);
    umapInterval = setInterval(() => {
      const update = { x: [], y: [] };
      for (let ti=0; ti<traces.length; ti++){
        const oldx = traces[ti].x;
        const oldy = traces[ti].y;
        const newx = oldx.map(v => v + (Math.random() - 0.5) * 0.06);
        const newy = oldy.map(v => v + (Math.random() - 0.5) * 0.06);
        traces[ti].x = newx; traces[ti].y = newy;
        update.x.push(newx); update.y.push(newy);
      }
      Plotly.update(umapPlotEl, update, {}, traces.map((_,i)=>i));
    }, 300);
  }

  /* -------------------------
     Abundance filter download
     ------------------------- */
  if (downloadFilterBtn) {
    downloadFilterBtn.addEventListener('click', () => {
      const q = (filterInput.value || '').trim().toLowerCase();
      const filtered = DUMMY.abundance.filter(r => r.Taxonomy.toLowerCase().includes(q));
      const rows = [['Taxonomy','Read_Count'], ...filtered.map(r => [r.Taxonomy, r.Read_Count])];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      downloadCSV('filtered_abundance.csv', csv);
    });
  }

  /* -------------------------
     Diversity widgets
     ------------------------- */
  // REPLACE your existing renderDiversityWidgets() with this function
function renderDiversityWidgets() {
  // categories for ring
  const categories = [
  { key: 'phytoplankton', label: 'Phytoplankton' },   // diatoms, dinoflagellates, cyanobacteria
  { key: 'microbes', label: 'Marine microbes' },      // bacteria, archaea
  { key: 'invertebrates', label: 'Invertebrates' },   // molluscs, crustaceans, cnidaria
  { key: 'fish', label: 'Fish' },                     // bony and cartilaginous fish
  { key: 'marine_plants', label: 'Macroalgae/Plants' },// seagrass, macroalgae
  { key: 'other', label: 'Other' }                    // megafauna, unknowns
];


  // try to infer proportions from DUMMY; otherwise fallback defaults
  let proportions = [0.18, 0.12, 0.06, 0.04, 0.35, 0.25];
  try {
    const shannon = parseFloat((DUMMY && DUMMY.diversity && DUMMY.diversity.shannon) || NaN);
    const richness = parseFloat((DUMMY && DUMMY.diversity && DUMMY.diversity.richness) || NaN);
    if (!Number.isNaN(shannon) && !Number.isNaN(richness)) {
      const base = [18, 12, 6, 4, 35, 25];
      const richnessFactor = Math.min(1.8, Math.max(0.6, richness / 200));
      const shannonFactor = Math.min(1.6, Math.max(0.5, shannon / 3.5));
      const scaled = base.map((b, i) => {
        const tilt = (i === 1 || i === 2) ? richnessFactor * 1.12 : 1.0;
        return b * tilt * shannonFactor;
      });
      const s = scaled.reduce((a, b) => a + b, 0) || 1;
      proportions = scaled.map(v => v / s);
    }
  } catch (e) {
    console.warn('Diversity proportion inference failed, using defaults.', e);
  }

  // get target container (tab-diversity must exist in HTML)
  const tabDiv = document.getElementById('tab-diversity');
  if (!tabDiv) return;

  // create or reuse diversity widget container
  let dv = document.getElementById('diversity-widget');
  if (!dv) {
    dv = document.createElement('div');
    dv.id = 'diversity-widget';
    dv.style.display = 'flex';
    dv.style.flexDirection = 'column';
    dv.style.gap = '12px';
    dv.style.width = '100%';
    dv.style.boxSizing = 'border-box';
  }

  // Insert AFTER existing KPI block (.indices) so KPIs remain on top
  const indicesDiv = tabDiv.querySelector('.indices');
  if (indicesDiv) {
    // If already inserted somewhere else, move it to right place
    if (indicesDiv.parentNode && indicesDiv.parentNode !== dv.parentNode) {
      // insert dv after indicesDiv
      if (indicesDiv.nextSibling) indicesDiv.parentNode.insertBefore(dv, indicesDiv.nextSibling);
      else indicesDiv.parentNode.appendChild(dv);
    } else {
      // ensure dv present in tabDiv
      if (!tabDiv.contains(dv)) {
        if (indicesDiv.nextSibling) indicesDiv.parentNode.insertBefore(dv, indicesDiv.nextSibling);
        else indicesDiv.parentNode.appendChild(dv);
      }
    }
  } else {
    // fallback: append to end of tabDiv
    if (!tabDiv.contains(dv)) tabDiv.appendChild(dv);
  }

  // clear previous content
  dv.innerHTML = '';

  // small title row (keeps consistent styling)
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginTop = '6px';
  header.innerHTML = `<strong style="color:var(--accent-strong)">Diversity Overview</strong>
                      <small class="muted">Visual breakdown by major organism groups</small>`;
  dv.appendChild(header);

  // chart wrapper
  const chartWrap = document.createElement('div');
  chartWrap.style.display = 'flex';
  chartWrap.style.justifyContent = 'center';
  chartWrap.style.alignItems = 'center';
  chartWrap.style.padding = '10px';
  chartWrap.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.01), transparent)';
  chartWrap.style.border = '1px solid rgba(255,255,255,0.03)';
  chartWrap.style.borderRadius = '10px';
  chartWrap.style.overflow = 'hidden';
  chartWrap.style.width = '100%';
  chartWrap.style.boxSizing = 'border-box';
  dv.appendChild(chartWrap);

  // plot div
  let plotEl = document.getElementById('diversity-plot-ring');
  if (!plotEl) {
    plotEl = document.createElement('div');
    plotEl.id = 'diversity-plot-ring';
    plotEl.style.width = '100%';
    plotEl.style.maxWidth = '720px';
    plotEl.style.height = '420px';
    plotEl.style.margin = '8px 0';
    chartWrap.appendChild(plotEl);
  } else {
    // move it inside chartWrap if not already (ensures correct placement)
    if (plotEl.parentNode !== chartWrap) chartWrap.appendChild(plotEl);
  }

  // build Plotly donut
  const labels = categories.map(c => c.label);
  const values = proportions.map(p => Math.round(p * 1000) / 1000);
  const colors = ['#7fc97f', '#b15928', '#8073ac', '#ffff99', '#66c2a5', '#fdb462'];

  const trace = {
    labels,
    values,
    type: 'pie',
    hole: 0.52,
    sort: false,
    direction: 'clockwise',
    marker: { colors, line: { color: document.body.classList.contains('light') ? '#fff' : '#0b0c10', width: 1 } },
    hoverinfo: 'label+percent+value',
    textinfo: 'label+percent',
    textposition: 'outside',
    automargin: true
  };

  const isLightMode = document.body.classList.contains('light');
  const textColor = isLightMode ? '#0b1220' : '#ffffff';

  const shannonLabel = (DUMMY && DUMMY.diversity && DUMMY.diversity.shannon) ? String(DUMMY.diversity.shannon) : '—';
  const richnessLabel = (DUMMY && DUMMY.diversity && DUMMY.diversity.richness) ? String(DUMMY.diversity.richness) : '—';

  const layout = {
    margin: { t: 18, b: 8, l: 8, r: 8 },
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 0.5,
      xanchor: 'center',
      y: -0.08,
      font: { color: textColor }
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: textColor, family: 'Roboto, sans-serif' },
    annotations: [
      {
        text: `Diversity\nH: ${shannonLabel} · S: ${richnessLabel}`,
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        xanchor: 'center',
        yanchor: 'middle',
        align: 'center',
        font: { size: 13, color: textColor }
      }
    ]
  };

  // Render
  Plotly.react(plotEl, [trace], layout, { responsive: true, displaylogo: false });

  // explanatory caption under chart
  const caption = document.createElement('div');
  caption.className = 'muted';
  caption.style.fontSize = '13px';
  caption.style.marginTop = '8px';
  caption.textContent =
    'Ring visualization groups species into major organism categories. Percentages are illustrative and derived from sample diversity metrics; use numeric indices above for exact values.';
  dv.appendChild(caption);

  // theme toggle re-render hookup (once)
  if (!renderDiversityWidgets._themeBound) {
    renderDiversityWidgets._themeBound = true;
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        setTimeout(() => { renderDiversityWidgets(); }, 60);
      });
    }
  }
}


  /* -------------------------
     CSV parsing helpers (robust CSV with quotes)
     ------------------------- */
  function parseCSVLines(csvText) {
    // returns array of arrays (rows x columns)
    const lines = csvText.split('\n');
    const rows = [];
    for (let ln of lines) {
      if (ln.trim() === '') continue;
      const cols = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i];
        if (ch === '"' && ln[i+1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; continue; }
        cur += ch;
      }
      cols.push(cur);
      rows.push(cols);
    }
    return rows;
  }

  /* -------------------------
     CSV preview for Analysis page (existing function)
     kept only for analysis preview (not used for seq table)
     ------------------------- */
  function renderCSVPreviewFromString(csvString, maxRows = 200, targetLocation = 'analysis') {
    const lines = csvString.split('\n').filter(Boolean);
    if (lines.length === 0) return;
    const parseLine = (ln) => {
      const cols = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i];
        if (ch === '"' && ln[i+1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { cols.push(cur); cur = ''; continue; }
        cur += ch;
      }
      cols.push(cur);
      return cols;
    };

    const rows = lines.map(l => parseLine(l));
    const header = rows[0] || [];
    const dataRows = rows.slice(1, 1 + maxRows);

    // only create container for analysis page (do nothing for results)
    if (targetLocation !== 'analysis') return;

    let container = document.getElementById('csv-preview-container-analysis');
    if (!container) {
      container = document.createElement('div');
      container.id = 'csv-preview-container-analysis';
      container.className = 'card';
      container.style.marginTop = '16px';
      container.style.overflow = 'auto';
      container.style.maxHeight = '420px';
      const pipelineCard = document.querySelector('#analysis-page .pipeline-card');
      if (pipelineCard) {
        pipelineCard.appendChild(container);
      } else {
        document.getElementById('analysis-page').appendChild(container);
      }
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.display = 'block';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    header.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.padding = '8px';
      th.style.textAlign = 'left';
      th.style.fontWeight = '700';
      th.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
      th.style.fontSize = '12px';
      th.style.color = 'var(--accent-strong)';
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    dataRows.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        td.style.padding = '8px';
        td.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        td.style.fontSize = '12px';
        td.style.color = 'var(--muted)';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.innerHTML = '';
    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.justifyContent = 'space-between';
    heading.style.alignItems = 'center';
    heading.style.marginBottom = '8px';
    heading.innerHTML = `<strong style="color:var(--accent-strong)">Preview: Final CSV report</strong>
      <small class="muted">${rows.length - 1} rows total (showing max ${maxRows})</small>`;
    container.appendChild(heading);
    container.appendChild(table);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.className = 'muted';
    note.style.fontSize = '12px';
    note.textContent = 'This is a preview of the final CSV report. Use "Download Final CSV Report" to get the full file.';
    container.appendChild(note);
  }

  /* -------------------------
     Download final CSV button wiring
     uses the same makeCSV generator to produce file
     ------------------------- */
  if (downloadFinalBtn) {
    downloadFinalBtn.addEventListener('click', () => {
      const csv = makeCSV(250);
      downloadCSV('edna_final_report.csv', csv);
      // do not modify preview visibility
    });
  }

  /* -------------------------
     Utility: read first uploaded CSV file text
     returns Promise<string|null>
     ------------------------- */
  function readFirstUploadedCSVText() {
    return new Promise((resolve) => {
      if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
        resolve(null);
        return;
      }
      const csvFile = uploadedFiles.find(f => typeof f.name === 'string' && f.name.toLowerCase().endsWith('.csv'));
      if (!csvFile) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(csvFile);
    });
  }

  /* -------------------------
     Always-visible seq_id & Sequence table under Analysis pipeline
     - If user uploaded a CSV with seq_id & Sequence columns -> use that (first 250 rows)
     - Else -> use generated makeCSV(250)
     - Table remains visible anytime (rendered under analysis pipeline)
     ------------------------- */
  async function renderSeqIdTable(rowsCount = 250) {
    // ensure container exists
    let container = document.getElementById('seqid-sequence-table');
    if (!container) {
      container = document.createElement('div');
      container.id = 'seqid-sequence-table';
      container.className = 'card';
      container.style.marginTop = '16px';
      container.style.overflow = 'auto';
      container.style.maxHeight = '420px';
      container.style.padding = '12px';

      // place under pipeline-card (as requested: below the box)
      const pipelineCard = document.querySelector('#analysis-page .pipeline-card');
      if (pipelineCard) pipelineCard.parentNode.insertBefore(container, pipelineCard.nextSibling);
      else document.getElementById('analysis-page').appendChild(container);
    }

    // attempt to read first uploaded CSV for real data
    const uploadedCsvText = await readFirstUploadedCSVText();

    let rows = null;
    let header = null;

    if (uploadedCsvText) {
      try {
        const parsed = parseCSVLines(uploadedCsvText);
        if (parsed.length > 0) {
          header = parsed[0].map(h => String(h).trim());
          rows = parsed.slice(1);
        }
      } catch (err) {
        console.warn('Uploaded CSV parse failed, falling back to generated CSV', err);
      }
    }

    if (!rows) {
      // fall back to generated CSV text
      const csvText = makeCSV(rowsCount);
      const parsed = parseCSVLines(csvText);
      if (parsed.length > 0) {
        header = parsed[0].map(h => String(h).trim());
        rows = parsed.slice(1);
      } else {
        rows = [];
        header = ['seq_id', 'Sequence'];
      }
    }

    // find seq_id and sequence indices (case-insensitive)
    const seqIdIdx = header.findIndex(h => String(h).trim().toLowerCase() === 'seq_id');
    const sequenceIdx = header.findIndex(h => String(h).trim().toLowerCase() === 'sequence');

    // If columns not present, attempt best-effort: first two columns or generate dummy seqs
    let useGeneratedFallback = false;
    if (seqIdIdx === -1 || sequenceIdx === -1) {
      // if rows exist and have at least 2 columns -> use first two columns as seq_id & sequence
      if (rows.length > 0 && rows[0].length >= 2) {
        // use 0 and 1
      } else {
        // fallback to generated dummy rows
        useGeneratedFallback = true;
      }
    }

    let dataRowsToUse = [];

    if (useGeneratedFallback) {
      for (let i = 1; i <= rowsCount; i++) {
        const seq = Array.from({ length: 80 }, () => ['A','T','G','C'][Math.floor(Math.random()*4)]).join('');
        dataRowsToUse.push([`SEQ_${String(i).padStart(4,'0')}`, seq]);
      }
    } else {
      // pick appropriate indices
      let idIdx = seqIdIdx;
      let seqIdx = sequenceIdx;
      if (idIdx === -1 || seqIdx === -1) {
        // pick 0 & 1 fallback
        idIdx = 0; seqIdx = 1;
      }
      for (let i = 0; i < Math.min(rowsCount, rows.length); i++) {
        const r = rows[i];
        // guard index
        const idVal = (r[idIdx] !== undefined) ? r[idIdx] : '';
        const seqVal = (r[seqIdx] !== undefined) ? r[seqIdx] : '';
        dataRowsToUse.push([String(idVal).replace(/^"|"$/g, ''), String(seqVal).replace(/^"|"$/g, '')]);
      }
      // if uploaded CSV had fewer than rowsCount rows, pad with generated ones to reach rowsCount
      if (dataRowsToUse.length < rowsCount) {
        const needed = rowsCount - dataRowsToUse.length;
        for (let j = 0; j < needed; j++) {
          const idx = dataRowsToUse.length + 1;
          const seq = Array.from({ length: 80 }, () => ['A','T','G','C'][Math.floor(Math.random()*4)]).join('');
          dataRowsToUse.push([`SEQ_PAD_${String(idx).padStart(4,'0')}`, seq]);
        }
      }
    }

    // build HTML table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';

    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    ['seq_id', 'Sequence'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.padding = '8px';
      th.style.textAlign = 'left';
      th.style.fontWeight = '700';
      th.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
      th.style.color = 'var(--accent-strong)';
      thr.appendChild(th);
    });
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    dataRowsToUse.forEach(r => {
      const tr = document.createElement('tr');
      r.forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.padding = '8px';
        td.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        td.style.color = 'var(--muted)';
        td.style.wordBreak = 'break-word';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // inject
    container.innerHTML = `<strong style="color:var(--accent-strong);display:block;margin-bottom:10px">
      Input Preview
    </strong>`;
    container.appendChild(table);
  } // end renderSeqIdTable

  /* -------------------------
     Initial wiring & boot
     ------------------------- */
  function initialPopulate() {
    // populate results metrics and charts
    populateResults();
    // render file list if any
    renderFileList();
    // set up UI states
    if (startAnalysisBtn) startAnalysisBtn.disabled = true;
    if (btnPause) btnPause.disabled = true;
    if (btnCancel) btnCancel.disabled = true;
    if (btnToResults) btnToResults.disabled = true;

    // setup tabs
    setupTabs();

    // render always-visible seq table (250 rows)
    renderSeqIdTable(250);
  }

  // startAnalysisBtn is already configured above with proper file validation

  // wire browse button (duplicate safe)
  const browseBtnElement = document.getElementById('browse-btn');
  if (browseBtnElement) browseBtnElement.addEventListener('click', () => {
    const fi = document.getElementById('dna-file-upload');
    if (fi) fi.click();
  });

  // wire an extra file select handler (keep compatibility)
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      uploadedFiles = Array.from(e.target.files || []);
      renderFileList();
      setTimeout(() => renderSeqIdTable(250), 120);
    });
  }

  // start initial population on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialPopulate);
  } else {
    initialPopulate();
  }

  // cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (umapInterval) clearInterval(umapInterval);
  });

})();
