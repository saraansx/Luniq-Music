const fs = require('fs');

async function generateStarHistory() {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github.v3.star+json',
    'User-Agent': 'Star-History-Generator',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  let stargazers = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://api.github.com/repos/saraansx/Luniq-Music/stargazers?per_page=100&page=${page}`, { headers });
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    stargazers = stargazers.concat(data);
    if (data.length < 100) break;
    page++;
  }

  console.log(`Fetched ${stargazers.length} stargazers.`);
  
  if (stargazers.length === 0) {
    console.log('No stargazers fetched, keeping existing chart.');
    return;
  }

  const points = stargazers.map((s, idx) => ({
    index: idx + 1,
    date: new Date(s.starred_at)
  }));

  const startDate = points[0].date;
  const endDate = new Date();
  const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));

  const maxStars = Math.max(120, Math.ceil((stargazers.length + 10) / 20) * 20);
  
  function getX(d) {
    const elapsed = (d - startDate) / (1000 * 60 * 60 * 24);
    return (90 + Math.min(650, (elapsed / totalDays) * 650)).toFixed(1);
  }
  
  function getY(count) {
    return (330 - (count / maxStars) * 260).toFixed(1);
  }

  let pathD = `M 90 330`;
  const sampledPoints = [];
  const step = Math.max(1, Math.floor(points.length / 25));
  for (let i = 0; i < points.length; i += step) {
    sampledPoints.push(points[i]);
  }
  if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
    sampledPoints.push(points[points.length - 1]);
  }

  sampledPoints.forEach(p => {
    pathD += ` L ${getX(p.date)} ${getY(p.index)}`;
  });

  const lastX = getX(endDate);
  const lastY = getY(points.length);
  pathD += ` L ${lastX} ${lastY}`;

  const areaD = `${pathD} L ${lastX} 330 Z`;

  const gridLines = [];
  const yStep = maxStars / 6;
  for (let i = 0; i <= 6; i++) {
    const val = Math.round(i * yStep);
    const y = getY(val);
    gridLines.push(`
      <line x1="90" y1="${y}" x2="740" y2="${y}" class="grid" opacity="0.6" />
      <text x="75" y="${(parseFloat(y) + 4).toFixed(1)}" text-anchor="end" class="axis-text">${val}</text>
    `);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="100%" height="100%">
  <defs>
    <style>
      .bg { fill: #0d1117; rx: 8px; }
      .grid { stroke: #21262d; stroke-width: 1; stroke-dasharray: 4 4; }
      .axis { stroke: #30363d; stroke-width: 2; }
      .axis-text { fill: #8b949e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; }
      .title-text { fill: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; }
      .line { fill: none; stroke: #ff7b72; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
      .area { fill: url(#grad); opacity: 0.15; }
      .dot { fill: #ff7b72; stroke: #0d1117; stroke-width: 2; }
      .legend-bg { fill: #161b22; stroke: #30363d; stroke-width: 1; rx: 6px; }
      .watermark { fill: #484f58; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; }
    </style>
    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff7b72" stop-opacity="1" />
      <stop offset="100%" stop-color="#ff7b72" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect width="800" height="420" class="bg" />

  ${gridLines.join('')}

  <line x1="90" y1="70" x2="90" y2="330" class="axis" />
  <line x1="90" y1="330" x2="740" y2="330" class="axis" />

  <text x="35" y="200" text-anchor="middle" transform="rotate(-90 35 200)" class="title-text">GitHub Stars</text>

  <path d="${areaD}" class="area" />
  <path d="${pathD}" class="line" />

  <circle cx="${lastX}" cy="${lastY}" r="5" class="dot" />

  <rect x="110" y="85" width="185" height="32" class="legend-bg" />
  <rect x="122" y="97" width="10" height="10" rx="2" fill="#ff7b72" />
  <text x="140" y="106" class="title-text" font-size="13">saraansx/Luniq-Music</text>

  <text x="740" y="390" text-anchor="end" class="watermark">star-history</text>
</svg>`;

  fs.writeFileSync('src/assets/star-history.svg', svg);
  console.log('Successfully generated src/assets/star-history.svg!');
}

generateStarHistory();
