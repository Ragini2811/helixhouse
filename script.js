// script-fixed.js — corrected and theme-safe version of your pipeline script

// --------------------- Helper / config ---------------------
const DUMMY = {
  overview: { dnaCount: '789,245', taxaDetected: '1,830', novelGroups: '62' },
  diversity: { shannon: '5.12', simpson: '0.983', richness: '740' },
  species: [
    'Bacteroides fragilis','Prevotella copri','Parabacteroides distasonis',
    'Faecalibacterium prausnitzii','Ruminococcus bromii','Eubacterium rectale',
    'Roseburia intestinalis','Coprococcus eutactus','Akkermansia muciniphila','Methanobrevibacter smithii',
    'Clostridium leptum', 'Bifidobacterium longum', 'Lactobacillus reuteri',
    'Enterococcus faecalis', 'Escherichia coli', 'Blautia obeum',
    'Dorea longicatena', 'Alistipes putredinis', 'Subdoligranulum variabile'
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

// 7-step config (keeps your earlier durations)
const PIPE_STEPS = [
  { id:'ingest', title:'Data Ingestion', icon:'fas fa-database', duration:1200 },
  { id:'kmer', title:'K-mer Conversion', icon:'fas fa-code', duration:900 },
  { id:'embed', title:'Embedding (BERT)', icon:'fas fa-brain', duration:1400 },
  { id:'inference', title:'Model Inference', icon:'fas fa-vial', duration:1300 },
  { id:'cluster', title:'Clustering (HDBSCAN)', icon:'fas fa-cubes', duration:1100 },
  { id:'diversity', title:'Diversity Metrics', icon:'fas fa-chart-line', duration:800 },
  { id:'annotation', title:'Taxonomic Annotation', icon:'fas fa-tag', duration:700 }
];

// --------------------- DOM refs ---------------------
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');

const fileInput = document.getElementById('dna-file-upload');
const browseBtn = document.getElementById('browse-btn');
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('file-list');
const startAnalysisBtn = document.getElementById('start-analysis-btn');
const fastSimBtn = document.getElementById('fast-sim');
const clearFilesBtn = document.getElementById('clear-files');

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

// --------------------- Utilities ---------------------
const raf = () => new Promise(r => requestAnimationFrame(r));
function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randFloat(min,max,dec=4){ return (Math.random()*(max-min)+min).toFixed(dec); }
function randSeq(len=60){ const bases=['A','T','C','G']; let s=''; for(let i=0;i<len;i++) s+=randChoice(bases); return s; }

function getTextColor() {
  return document.body.classList.contains('light') ? '#0b1220' : '#ffffff';
}
function getPanelBg() {
  return document.body.classList.contains('light') ? '#ffffff' : '#1a1a1a';
}

// CSV maker (same as before)
function makeCSV(rowsCount = 250) {
  const header = [
    'seq_id','Sequence','Marker','Taxonomy','Source','Sample_ID','Read_Count',
    'Taxonomic_Level','Confidence_Score','Location','Depth_m','kmer_sequence',
    'pred_1','pred_1_conf','pred_2','pred_2_conf','pred_3','pred_3_conf',
    'umap_x','umap_y'
  ];
  const rows = [];
  const SPECIES = DUMMY.species;
  const MARKERS = ['COI','18S'];
  const SOURCES = ['CCLME','DeepSEARCH','Mendeley','USGS'];
  const LOCATIONS = ['Seamount_B','Trench_A','Slope_B','Vent_A','AbyssalPlain_B','Canyon_A','Trench_B'];
  const TAX_LEVELS = ['species','species_predicted','genus','family'];

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

    rows.push([
      seqId,sequence,marker,taxonomy,source,sample,readCount,
      taxLevel,confScore,location,depth,kmerSeq,
      pred1,pred1c,pred2,pred2c,pred3,pred3c,umapX,umapY
    ]);
  }
  return [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
}

function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'report.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// --------------------- Navigation & theme ---------------------
function navigate(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  navLinks.forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (active) active.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
  
  // Auto-start analysis if navigating to analysis page (only if not completed)
  if (pageId === 'analysis-page' && !analysisCompleted) {
    setTimeout(() => {
      // Create demo data if no files uploaded
      if (uploadedFiles.length === 0) {
        uploadedFiles = [{ name: 'demo_sample.fastq', size: 1500000 }];
        if (statSamples) statSamples.textContent = '1';
      }
      resetPipelineUI();
      runPipeline();
    }, 500);
  }
}

navLinks.forEach(link => {
  link.addEventListener('click', () => navigate(link.getAttribute('data-page')));
});

function setTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  themeToggle.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  // Re-render any UI that depends on theme colors
  safeRefreshUIForTheme();
}
setTheme(false);
themeToggle.addEventListener('click', () => setTheme(!document.body.classList.contains('light')));

function safeRefreshUIForTheme(){
  // Update Plotly charts, diversity widgets and CSV preview to ensure text/plot colors update
  try { renderAbundanceChart(); } catch(e) { console.warn('abundance refresh failed',e); }
  try { renderUMAPAnimation(); } catch(e) { console.warn('umap refresh failed',e); }
  try { if (typeof renderDiversityWidgets === 'function') renderDiversityWidgets(); } catch(e) { console.warn('diversity refresh failed',e); }
  // Update CSV preview styles (if exists)
  const csvContainer = document.getElementById('csv-preview-container-analysis');
  if (csvContainer) {
    csvContainer.style.background = getPanelBg();
    csvContainer.style.color = getTextColor();
    // update header/text colors inside table
    const ths = csvContainer.querySelectorAll('th');
    ths.forEach(th => th.style.color = getTextColor());
    const tds = csvContainer.querySelectorAll('td');
    tds.forEach(td => td.style.color = getTextColor());
  }
}

// --------------------- File upload UI ---------------------
let uploadedFiles = [];

function renderFileList() {
  if (!fileList) return;
  fileList.innerHTML = '';
  if (uploadedFiles.length === 0) {
    fileList.innerHTML = '<p class="muted">No files selected.</p>';
    startAnalysisBtn && (startAnalysisBtn.disabled = true);
    if (statSamples) statSamples.textContent = '0';
    return;
  }
  const ul = document.createElement('ul'); ul.style.listStyle='none'; ul.style.padding='0';
  uploadedFiles.forEach((f,i) => {
    const li = document.createElement('li');
    li.style.padding='8px'; li.style.marginBottom='8px'; li.style.borderRadius='8px';
    li.style.background='rgba(255,255,255,0.02)';
    li.innerHTML = `<strong>${f.name}</strong> <small class="muted">(${(f.size/1024/1024).toFixed(2)} MB)</small>
      <button class="btn ghost remove-file" data-idx="${i}" style="margin-left:12px">Remove</button>`;
    ul.appendChild(li);
  });
  fileList.appendChild(ul);
  startAnalysisBtn && (startAnalysisBtn.disabled = false);
  if (statSamples) statSamples.textContent = String(uploadedFiles.length);
  fileList.querySelectorAll('.remove-file').forEach(b => {
    b.addEventListener('click', () => {
      const idx = Number(b.getAttribute('data-idx'));
      uploadedFiles.splice(idx,1);
      renderFileList();
    });
  });
}

browseBtn && browseBtn.addEventListener('click', () => fileInput && fileInput.click());
fileInput && fileInput.addEventListener('change', (e) => { uploadedFiles = Array.from(e.target.files); renderFileList(); });
dropzone && dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone && dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone && dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); uploadedFiles = Array.from(e.dataTransfer.files); renderFileList(); });
clearFilesBtn && clearFilesBtn.addEventListener('click', () => { uploadedFiles = []; if (fileInput) fileInput.value = ''; renderFileList(); });

// --------------------- Build visual pipeline (7 boxes) ---------------------
function buildVisualPipeline() {
  if (!pipelineContainer) return;
  // Clear existing children (keeps other nodes in pipeline-container safe)
  pipelineContainer.innerHTML = '';
  pipelineContainer.classList.add('train-container');

  // For each PIPE_STEPS create a .pipeline-step visual box
  PIPE_STEPS.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'pipeline-step';
    el.dataset.stepIndex = i;
    el.dataset.stepId = s.id;
    el.innerHTML = `
      <div class="step-inner">
        <div class="step-icon"><i class="${s.icon}"></i></div>
        <h4>${s.title}</h4>
        <div class="step-status muted" aria-hidden="true">Pending</div>
      </div>
    `;
    pipelineContainer.appendChild(el);
  });

  // Ensure layout update and initial positioning
  requestAnimationFrame(() => {
    positionTrain(0, 0); // No transition on initial load
  });
}

// Initialize pipeline on load
if (pipelineContainer) {
  buildVisualPipeline();
}

// Positioning logic: spacing and center index
function positionTrain(activeIndex, transitionMs = 420) {
  if (!pipelineContainer) return;
  const cars = Array.from(pipelineContainer.querySelectorAll('.pipeline-step'));
  const count = cars.length;
  const containerWidth = pipelineContainer.clientWidth || 900;

  const spacing = Math.min(160, Math.max(100, Math.floor(containerWidth / Math.max(5, count + 1))));

  cars.forEach((car, idx) => {
    const offsetFromActive = idx - activeIndex;
    const tx = offsetFromActive * spacing;
    const isActive = idx === activeIndex;
    const scale = isActive ? 1.12 : 0.92;
    const z = isActive ? 50 : Math.max(10, 40 - Math.abs(offsetFromActive));

    car.style.transition = `transform ${transitionMs}ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms, opacity 220ms`;
    car.style.transform = `translateX(${tx}px) translateY(0px) scale(${scale})`;
    car.style.zIndex = z;

    const statusEl = car.querySelector('.step-status');
    if (statusEl) {
      if (isActive) statusEl.textContent = 'Processing...';
      else if (car.classList.contains('completed')) statusEl.textContent = 'Complete';
      else statusEl.textContent = 'Pending';
    }
  });
}

async function animateToStep(stepIndex, durationMs) {
  if (!pipelineContainer) return;
  const cars = Array.from(pipelineContainer.querySelectorAll('.pipeline-step'));
  if (!cars.length) return;
  stepIndex = Math.max(0, Math.min(cars.length - 1, stepIndex));
  
  positionTrain(stepIndex, 420);

  cars.forEach((c, idx) => {
    c.classList.remove('active');
    if (idx < stepIndex) c.classList.add('completed');
    else c.classList.remove('completed');
  });
  
  const activeCar = cars[stepIndex];
  if (activeCar) {
    activeCar.classList.add('active');
    const iconEl = activeCar.querySelector('.step-icon i');
    if (iconEl) {
      iconEl.classList.add('fa-spinner', 'fa-spin');
      iconEl.classList.remove('fa-check-circle');
    }
  }

  try { activeCar && activeCar.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } catch(e){}

  const start = performance.now();
  let pausedAccum = 0, pauseStart = null;
  
  while (true) {
    if (simState.cancelled) throw new Error('cancelled');
    if (simState.paused) {
      if (!pauseStart) pauseStart = performance.now();
      await new Promise(r => setTimeout(r, 80));
      continue;
    } else if (pauseStart) {
      pausedAccum += performance.now() - pauseStart;
      pauseStart = null;
    }
    const now = performance.now();
    const elapsed = now - start - pausedAccum;
    const pct = Math.min(1, elapsed / durationMs);
    const globalPct = Math.round(((stepIndex + pct) / PIPE_STEPS.length) * 100);
    if (globalProgressFill) globalProgressFill.style.width = `${globalPct}%`;
    if (progressText) progressText.textContent = `${PIPE_STEPS[stepIndex].title} — ${Math.round(pct * 100)}%`;
    if (elapsed >= durationMs) break;
    await raf();
  }
}

// ---------- runPipeline ----------
async function runPipeline() {
  if (simState.running || analysisCompleted) return;
  if (uploadedFiles.length === 0) { 
    alert('Please upload at least one file (or use Demo Data).'); 
    return; 
  }

  simState.running = true; 
  simState.paused = false; 
  simState.cancelled = false;
  btnPause && (btnPause.disabled = false);
  btnCancel && (btnCancel.disabled = false);
  btnToResults && (btnToResults.disabled = true);
  if (globalProgressFill) globalProgressFill.style.width = '0%';
  if (progressText) progressText.textContent = 'Starting analysis...';

  const cars = Array.from(pipelineContainer ? pipelineContainer.querySelectorAll('.pipeline-step') : []);
  if (!cars.length) buildVisualPipeline();

  try {
    for (let i = 0; i < PIPE_STEPS.length; i++) {
      if (simState.cancelled) throw new Error('cancelled');

      const duration = PIPE_STEPS[i].duration || 1000;
      await animateToStep(i, duration);

      const car = document.querySelector(`#pipeline-container .pipeline-step[data-step-index="${i}"]`);
      if (car) {
        car.classList.remove('active');
        car.classList.add('completed');
        const statusEl = car.querySelector('.step-status'); if (statusEl) statusEl.textContent = 'Complete';
        const iconI = car.querySelector('.step-icon i');
        if (iconI) {
          iconI.classList.remove('fa-spinner', 'fa-spin');
          iconI.classList.add('fa-check-circle');
        }
      }

      await new Promise(r => setTimeout(r, 400));

      if (i + 1 < PIPE_STEPS.length) {
        positionTrain(i + 1, 600);
        document.querySelectorAll('#pipeline-container .pipeline-step').forEach((c, idx) => {
          c.classList.toggle('completed', idx <= i);
          c.classList.toggle('active', idx === i + 1);
        });
        await new Promise(r => setTimeout(r, 350));
      } else {
        positionTrain(i, 420);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (globalProgressFill) globalProgressFill.style.width = '100%';
    if (progressText) progressText.textContent = 'Analysis complete — results ready.';
    btnToResults && (btnToResults.disabled = false);
    btnPause && (btnPause.disabled = true);
    btnCancel && (btnCancel.disabled = true);
    simState.running = false;
    analysisCompleted = true;

    const csv = makeCSV(250);
    renderCSVPreviewFromString(csv, 200, 'analysis');

  } catch (err) {
    if (err.message === 'cancelled') {
      if (progressText) progressText.textContent = 'Cancelled';
      resetPipelineUI();
    } else {
      console.error(err);
      if (progressText) progressText.textContent = 'Error during analysis';
      resetPipelineUI();
    }
  }
}

// --------------------- Pipeline simulation engine (train flow) ---------------------
let simState = { running:false, paused:false, cancelled:false };
let analysisCompleted = false; // Add flag to track completion

function resetPipelineUI() {
  if (globalProgressFill) globalProgressFill.style.width = '0%';
  if (progressText) progressText.textContent = 'Waiting to start...';
  btnPause && (btnPause.disabled = true); btnCancel && (btnCancel.disabled = true); btnToResults && (btnToResults.disabled = true);
  simState = { running:false, paused:false, cancelled:false };
  
  document.querySelectorAll('#pipeline-container .pipeline-step').forEach(el => {
    el.classList.remove('active','completed');
    const s = el.querySelector('.step-status'); if (s) s.textContent = 'Pending';
    const iconEl = el.querySelector('.step-icon i');
    if (iconEl) {
      iconEl.className = ''; // clear all classes
      const stepId = el.dataset.stepId;
      const step = PIPE_STEPS.find(p => p.id === stepId);
      if (step) iconEl.className = step.icon;
    }
  });
  
  const existing = document.getElementById('csv-preview-container-analysis');
  if (existing) existing.remove();
  
  positionTrain(0, 0);
}
resetPipelineUI();

// Pause / Cancel handlers
btnPause && btnPause.addEventListener('click', () => {
  if (!simState.running) return;
  simState.paused = !simState.paused;
  btnPause.textContent = simState.paused ? 'Resume' : 'Pause';
  if (simState.paused) {
    if (progressText) progressText.textContent = progressText.textContent.replace(' — ', ' (PAUSED) — ');
  } else {
    if (progressText) progressText.textContent = progressText.textContent.replace(' (PAUSED) — ', ' — ');
  }
});

btnCancel && btnCancel.addEventListener('click', () => {
  if (!simState.running) return;
  simState.cancelled = true;
});

// start/go to results button
btnToResults && btnToResults.addEventListener('click', () => {
  populateResults();
  navigate('results-page');
  setTimeout(() => setupTabs(), 100);
});

// --------------------- CSV preview (analysis-only) ---------------------
function renderCSVPreviewFromString(csvString, maxRows = 200, targetLocation = 'analysis') {
  const lines = csvString.split('\n').filter(Boolean);
  if (!lines.length) return;
  function parseLine(ln) {
    const cols = []; let cur = '', inQuotes = false;
    for (let i=0;i<ln.length;i++) {
      const ch = ln[i];
      if (ch === '"' && ln[i+1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(cur); cur=''; continue; }
      cur += ch;
    }
    cols.push(cur); return cols;
  }
  const rows = lines.map(parseLine);
  const header = rows[0] || [];
  const dataRows = rows.slice(1, 1+maxRows);

  if (targetLocation !== 'analysis') return;
  let container = document.getElementById('csv-preview-container-analysis');
  if (!container) {
    container = document.createElement('div');
    container.id = 'csv-preview-container-analysis';
    container.className = 'card';
    container.style.marginTop = '16px';
    container.style.overflow = 'auto';
    container.style.maxHeight = '420px';
    container.style.padding = '12px';
    container.style.borderRadius = '8px';
    container.style.background = getPanelBg();
    const pipelineCard = document.querySelector('#analysis-page .pipeline-card');
    if (pipelineCard) pipelineCard.appendChild(container);
    else {
      const analysisPage = document.getElementById('analysis-page');
      analysisPage && analysisPage.appendChild(container);
    }
  }

  // Build table
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.display = 'block';

  const thead = document.createElement('thead'); const trh = document.createElement('tr');
  header.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.padding = '8px'; th.style.textAlign = 'left'; th.style.fontWeight = '700';
    th.style.borderBottom = '1px solid rgba(255,255,255,0.06)'; th.style.fontSize = '12px';
    th.style.color = getTextColor();
    trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  dataRows.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.style.padding = '8px';
      td.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      td.style.fontSize = '12px';
      td.style.color = getTextColor();
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.innerHTML = '';
  const heading = document.createElement('div');
  heading.style.display = 'flex'; heading.style.justifyContent = 'space-between'; heading.style.alignItems = 'center';
  heading.style.marginBottom = '8px';
  heading.innerHTML = `<strong style="color:var(--accent-strong)">Preview: Final CSV report</strong>
    <small class="muted">${Math.max(0, rows.length-1)} rows total (showing max ${maxRows})</small>`;
  container.appendChild(heading);
  container.appendChild(table);

  const note = document.createElement('div');
  note.style.marginTop = '8px'; note.className = 'muted'; note.style.fontSize = '12px';
  note.textContent = 'This is a preview of the final CSV report. Use "Download Final CSV Report" to get the full file.';
  container.appendChild(note);
}

// --------------------- Results population & charts (kept minimal) ---------------------
function populateResults() {
  metricDna && (metricDna.textContent = DUMMY.overview.dnaCount);
  metricTaxa && (metricTaxa.textContent = DUMMY.overview.taxaDetected);
  metricNovel && (metricNovel.textContent = DUMMY.overview.novelGroups);

  metricShannon && (metricShannon.textContent = DUMMY.diversity.shannon);
  metricSimpson && (metricSimpson.textContent = DUMMY.diversity.simpson);
  metricRichness && (metricRichness.textContent = DUMMY.diversity.richness);

  if (speciesListEl) speciesListEl.innerHTML = DUMMY.species.map(s => `<li>${s}</li>`).join('');
  if (clusterGrid) clusterGrid.innerHTML = DUMMY.clusters.map(c => `<div class="cluster"><strong>${c.id}</strong><div class="muted">${c.seq} seqs · ${c.reads} reads</div></div>`).join('');
  renderAbundanceChart();
  renderUMAPAnimation();
  if (typeof renderDiversityWidgets === 'function') renderDiversityWidgets();
}

// Abundance chart (Plotly)
function renderAbundanceChart() {
  if (!abundanceChartEl) return;
  const y = DUMMY.abundance.map(r => r.Taxonomy);
  const x = DUMMY.abundance.map(r => r.Read_Count);
  const isLightMode = document.body.classList.contains('light');
  const textColor = getTextColor();
  const barColor = isLightMode ? '#7d3cff' : '#8b63ff';
  const data = [{ x, y, type:'bar', orientation:'h', marker:{ color: barColor } }];
  const layout = { margin:{t:30,l:220,r:40,b:60}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', font:{color:textColor} };
  try { Plotly.react(abundanceChartEl, data, layout, {responsive:true}); } catch(e){ console.warn('plotly abundance error',e); }
}

// UMAP animation (synthetic)
let umapInterval = null;
let lastTraces = null;
function renderUMAPAnimation() {
  if (!umapPlotEl) return;
  const clusters = DUMMY.clusters;
  const points = [];
  clusters.forEach((c, idx) => {
    const centerX = (idx - 1) * 3.5;
    const centerY = (idx % 2 === 0) ? 0 : 2.2;
    for(let i=0;i<Math.max(8, c.seq); i++){
      points.push({ cluster:c.id, x:centerX + (Math.random()-0.5)*1.4, y:centerY + (Math.random()-0.5)*1.0 });
    }
  });
  const colors = ['#8b63ff','#c7b9ff','#6ec3b8'];
  const traces = [];
  const keys = [...new Set(points.map(p => p.cluster))];
  keys.forEach((k,i) => {
    const pts = points.filter(p => p.cluster === k);
    traces.push({ x: pts.map(p=>p.x), y: pts.map(p=>p.y), mode:'markers', type:'scatter', name:k, marker:{size:8, color:colors[i%colors.length], opacity:0.9} });
  });
  lastTraces = traces;

  const textColor = getTextColor();
  const layout = { margin:{t:30,l:20,r:20,b:20}, xaxis:{visible:false}, yaxis:{visible:false, scaleanchor:'x', scaleratio:1}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', font:{color:textColor} };
  try { Plotly.react(umapPlotEl, traces, layout, {responsive:true}); } catch(e){ console.warn('plotly umap render failed', e); }
  if (umapInterval) clearInterval(umapInterval);
  umapInterval = setInterval(() => {
    if (!lastTraces) return;
    const update = { x: [], y: [] };
    for(let ti=0; ti<lastTraces.length; ti++){
      const oldx = lastTraces[ti].x; const oldy = lastTraces[ti].y;
      const newx = oldx.map(v => v + (Math.random()-0.5)*0.06);
      const newy = oldy.map(v => v + (Math.random()-0.5)*0.06);
      lastTraces[ti].x = newx; lastTraces[ti].y = newy;
      update.x.push(newx); update.y.push(newy);
    }
    try { Plotly.update(umapPlotEl, update, {}, lastTraces.map((_,i)=>i)); } catch(e) {}
  }, 300);
}

// Diversity widgets (donut + spark)
function renderDiversityWidgets() {
  const shannon = parseFloat((DUMMY && DUMMY.diversity && DUMMY.diversity.shannon) || 5.12);
  const evennessPct = Math.min(1, shannon / 6.0);
  const isLightMode = document.body.classList.contains('light');
  
  const donutData = [{ 
    values: [evennessPct, 1-evennessPct], 
    labels: ['Evenness','Remaining'], 
    hole: 0.6, 
    type: 'pie', 
    marker: { 
      colors: [isLightMode ? '#7d3cff' : '#8b63ff', isLightMode ? '#e0e0e0' : '#2b2b2b'] 
    }, 
    textinfo: 'none' 
  }];
  
  let dv = document.getElementById('diversity-widget');
  if (!dv) { 
    dv = document.createElement('div'); 
    dv.id = 'diversity-widget'; 
    dv.style.display='flex'; 
    dv.style.gap='18px'; 
    const tabDiv = document.getElementById('tab-diversity'); 
    tabDiv && tabDiv.prepend(dv); 
  }
  dv.innerHTML = `<div id="div-donut" style="width:160px;height:160px"></div><div id="div-spark" style="flex:1; min-height:70px"></div>`;
  
  const donutLayout = {
    showlegend: false,
    margin: {t:10,b:10,l:10,r:10},
    paper_bgcolor: getPanelBg(),
    plot_bgcolor: getPanelBg(),
    font: { color: getTextColor() }
  };
  try { Plotly.react(document.getElementById('div-donut'), donutData, donutLayout, {responsive:true}); } catch(e){ console.warn('div donut failed',e); }
  
  const sparkX = ['S1','S2','S3','S4','S5','S6','S7','S8']; 
  const sparkY = [5.12,4.8,5.0,4.6,5.3,4.9,5.0,5.15];
  const spark = [{ 
    x: sparkX, 
    y: sparkY, 
    mode: 'lines+markers', 
    type: 'scatter', 
    line: { shape: 'spline', color: isLightMode ? '#5b2cff' : '#8b63ff' },
    marker: { color: isLightMode ? '#5b2cff' : '#8b63ff' }
  }];
  
  const sparkLayout = { 
    margin: {t:6,b:30,l:40,r:6}, 
    xaxis: {
      showgrid: true,
      zeroline: false,
      gridcolor: isLightMode ? '#e0e0e0' : '#333333',
      tickfont: { color: getTextColor() },
      showticklabels: true
    }, 
    yaxis: {
      showgrid: true,
      zeroline: false,
      gridcolor: isLightMode ? '#e0e0e0' : '#333333',
      tickfont: { color: getTextColor() },
      showticklabels: true
    }, 
    paper_bgcolor: getPanelBg(),
    plot_bgcolor: getPanelBg(),
    font: { color: getTextColor() }
  };
  
  try { Plotly.react(document.getElementById('div-spark'), spark, sparkLayout, {responsive:true}); } catch(e){ console.warn('div spark failed', e); }
}

// --------------------- Abundance filter CSV ---------------------
downloadFilterBtn && downloadFilterBtn.addEventListener('click', () => {
  const q = (filterInput.value || '').trim().toLowerCase();
  const filtered = DUMMY.abundance.filter(r => r.Taxonomy.toLowerCase().includes(q));
  const rows = [['Taxonomy','Read_Count'], ...filtered.map(r => [r.Taxonomy, r.Read_Count])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadCSV('filtered_abundance.csv', csv);
});

// --------------------- Hook up start button + download final ---------------------
startAnalysisBtn && (startAnalysisBtn.disabled = true);
btnPause && (btnPause.disabled = true); btnCancel && (btnCancel.disabled = true); btnToResults && (btnToResults.disabled = true);

if (startAnalysisBtn) {
  startAnalysisBtn.addEventListener('click', () => {
    console.log('Start analysis clicked, files:', uploadedFiles.length);
    if (analysisCompleted) {
      alert('Analysis already completed. Please refresh the page to run again.');
      return;
    }
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one file first.');
      return;
    }
    resetPipelineUI();
    navigate('analysis-page');
    setTimeout(() => { runPipeline(); }, 300);
  });
}

if (fastSimBtn) {
  fastSimBtn.addEventListener('click', () => {
    console.log('Fast sim clicked');
    uploadedFiles = [{ name: 'demo_sample.fastq', size: 1500000 }]; 
    renderFileList(); 
    setTimeout(() => { if (startAnalysisBtn && !startAnalysisBtn.disabled) startAnalysisBtn.click(); }, 250);
  });
}

if (downloadFinalBtn) {
  downloadFinalBtn.addEventListener('click', () => {
    const csv = makeCSV(250);
    downloadCSV('edna_final_report.csv', csv);
  });
}

// Initial render of results preview data & file-list
function initialPopulate() {
  renderFileList();
  populateResults();
}
initialPopulate();

// wire file handlers to keep consistent
fileInput && fileInput.addEventListener('change', (e) => { uploadedFiles = Array.from(e.target.files); renderFileList(); });
dropzone && dropzone.addEventListener('drop', (e) => { e.preventDefault(); uploadedFiles = Array.from(e.dataTransfer.files); renderFileList(); });

// Setup tabs for results (single definition)
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab[data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');
  tabButtons.forEach(button => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
  });
  const freshTabButtons = document.querySelectorAll('.tab[data-tab]');
  freshTabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.dataset.tab;
      freshTabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      this.classList.add('active');
      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}
setupTabs();

// cleanup on unload
window.addEventListener('beforeunload', () => { if (umapInterval) clearInterval(umapInterval); });
