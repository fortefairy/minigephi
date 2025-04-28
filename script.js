const fileInput = document.getElementById('fileInput');
const dataInput = document.getElementById('dataInput');
const loadFieldsBtn = document.getElementById('loadFieldsBtn');
const updateGraphBtn = document.getElementById('updateGraphBtn');
const nodeColorInput = document.getElementById('nodeColor');
const nodeSizeInput = document.getElementById('nodeSize');
const filterInput = document.getElementById('filterInput');
const downloadBtn = document.getElementById('downloadBtn');
const fieldMapping = document.getElementById('fieldMapping');
const sourceField = document.getElementById('sourceField');
const targetField = document.getElementById('targetField');
const weightField = document.getElementById('weightField');
const intervalField = document.getElementById('intervalField');
const graphDiv = document.getElementById('graph');
const timeFilter = document.getElementById('timeFilter');
const timeSlider = document.getElementById('timeSlider');
const currentYear = document.getElementById('currentYear');
const playButton = document.getElementById('playButton');

let rawData = [];
let nodes = [];
let links = [];
let simulation, svg, node, link, label, zoomLayer;
let minInterval = null;
let maxInterval = null;
let playInterval = null;

fileInput.addEventListener('change', handleFile);
loadFieldsBtn.addEventListener('click', () => {
  parseInput();
  populateFieldSelectors();
});
updateGraphBtn.addEventListener('click', () => {
  mapFields();
  createGraph();
});
nodeColorInput.addEventListener('input', updateNodeStyles);
nodeSizeInput.addEventListener('input', updateNodeStyles);
filterInput.addEventListener('input', filterGraph);
downloadBtn.addEventListener('click', downloadGraph);
playButton.addEventListener('click', togglePlay);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    dataInput.value = e.target.result;
  };
  reader.readAsText(file);
}

function parseInput() {
  const text = dataInput.value.trim();
  if (text.startsWith('[')) {
    rawData = JSON.parse(text);
  } else {
    rawData = d3.csvParse(text);
  }
}

function populateFieldSelectors() {
  if (!rawData.length) return;
  const keys = Object.keys(rawData[0]);
  fieldMapping.style.display = 'block';
  [sourceField, targetField, weightField, intervalField].forEach(select => {
    select.innerHTML = '';
    if (select !== sourceField && select !== targetField) {
      select.innerHTML = '<option value="">(none)</option>';
    }
  });
  keys.forEach(k => {
    [sourceField, targetField, weightField, intervalField].forEach(select => {
      select.appendChild(new Option(k, k));
    });
  });
  if (keys.includes('source')) sourceField.value = 'source';
  if (keys.includes('target')) targetField.value = 'target';
}

function mapFields() {
  const sourceKey = sourceField.value;
  const targetKey = targetField.value;
  const weightKey = weightField.value;
  const intervalKey = intervalField.value;

  if (!sourceKey || !targetKey) {
    alert("Source and Target fields are required!");
    return;
  }

  links = rawData.map(d => ({
    source: d[sourceKey],
    target: d[targetKey],
    weight: weightKey ? +d[weightKey] : undefined,
    interval: intervalKey ? parseInt(d[intervalKey]) : undefined
  }));

  const nodeSet = new Map();
  links.forEach(link => {
    if (!nodeSet.has(link.source)) nodeSet.set(link.source, { id: link.source, weight: 0 });
    if (!nodeSet.has(link.target)) nodeSet.set(link.target, { id: link.target, weight: 0 });
    nodeSet.get(link.source).weight += link.weight || 1;
    nodeSet.get(link.target).weight += link.weight || 1;
  });

  nodes = Array.from(nodeSet.values());

  if (intervalKey) {
    let intervals = links.map(d => d.interval).filter(v => !isNaN(v));
    if (intervals.length) {
      minInterval = Math.min(...intervals);
      maxInterval = Math.max(...intervals);
    } else {
      minInterval = parseInt(prompt("Enter minimum interval:"));
      maxInterval = parseInt(prompt("Enter maximum interval:"));
    }
    setupTimeSlider();
  } else {
    timeFilter.style.display = 'none';
  }
}

function createGraph() {
  graphDiv.innerHTML = '';

  const width = graphDiv.clientWidth;
  const height = graphDiv.clientHeight;

  svg = d3.select("#graph").append("svg")
    .attr("width", width)
    .attr("height", height);

  zoomLayer = svg.append("g");

  svg.call(d3.zoom()
    .extent([[0, 0], [width, height]])
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      zoomLayer.attr("transform", event.transform);
    })
  );

  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  link = zoomLayer.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => d.weight ? Math.sqrt(d.weight) : 2);

  node = zoomLayer.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => 5 + Math.sqrt(d.weight || 1) * 2)
    .attr("fill", nodeColorInput.value)
    .call(drag(simulation));

  label = zoomLayer.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.id)
    .attr("x", 8)
    .attr("y", "0.31em")
    .style("font-size", "12px")
    .style("user-select", "none");

  simulation.on("tick", () => {
    link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    node.attr("cx", d => d.x)
        .attr("cy", d => d.y);
    label.attr("x", d => d.x + 10)
         .attr("y", d => d.y);
  });
}

function drag(simulation) {
  return d3.drag()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

function updateNodeStyles() {
  if (node) {
    node.attr("fill", nodeColorInput.value)
        .attr("r", d => 5 + Math.sqrt(d.weight || 1) * 2);
  }
}

function filterGraph() {
  const keyword = filterInput.value.toLowerCase();
  node.attr("opacity", d => d.id.toLowerCase().includes(keyword) ? 1 : 0.1);
  label.attr("opacity", d => d.id.toLowerCase().includes(keyword) ? 1 : 0.1);
  link.attr("opacity", d => (d.source.id.toLowerCase().includes(keyword) || d.target.id.toLowerCase().includes(keyword)) ? 1 : 0.05);
}

function setupTimeSlider() {
  timeFilter.style.display = 'block';
  timeSlider.min = minInterval;
  timeSlider.max = maxInterval;
  timeSlider.value = minInterval;
  currentYear.textContent = minInterval;
  timeSlider.addEventListener('input', () => {
    currentYear.textContent = timeSlider.value;
    filterByTime();
  });
}

function filterByTime() {
  const year = parseInt(timeSlider.value);
  node.attr("opacity", d => {
    return links.some(link => (link.source.id === d.id || link.target.id === d.id) && link.interval <= year) ? 1 : 0.1;
  });
  label.attr("opacity", d => {
    return links.some(link => (link.source.id === d.id || link.target.id === d.id) && link.interval <= year) ? 1 : 0.1;
  });
  link.attr("opacity", d => d.interval <= year ? 1 : 0.05);
}

function togglePlay() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    playButton.textContent = "▶️";
  } else {
    playInterval = setInterval(() => {
      let next = parseInt(timeSlider.value) + 1;
      if (next > maxInterval) next = minInterval;
      timeSlider.value = next;
      currentYear.textContent = next;
      filterByTime();
    }, 1000);
    playButton.textContent = "⏸️";
  }
}

function downloadGraph() {
  saveSvgAsPng(document.querySelector("#graph svg"), "network-graph.png");
}
