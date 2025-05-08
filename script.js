async function generateMindMap() {
  const topic = document.getElementById("topic").value.trim();
  const mindmapDiv = document.getElementById("mindmap");

  if (!topic) {
    alert("Please enter a topic.");
    return;
  }

  mindmapDiv.innerHTML = "<div class='loading'>Generating mindmap...</div>";

  let markdown;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch("https://mindmap-backend-yk09.onrender.com/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      } else {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }

    const data = await response.json();
    markdown = data.markdown;
  } catch (err) {
    console.error("Fetch error:", err);
    if (err.name === 'AbortError') {
      alert("Request timed out. The backend may be waking up. Please try again in a moment.");
    } else if (err.message.includes('500')) {
      alert("Backend error: Failed to generate mind map. Please try again later or contact support.");
    } else {
      alert("Failed to fetch from backend. Please check your network or try again later.");
    }
    return;
  }

  mindmapDiv.innerHTML = "";

  try {
  if (!window.d3) {
    throw new Error("D3.js library not loaded. Please refresh the page and try again.");
  }
  if (!window.markmap || !window.markmap.Transformer || !window.markmap.Markmap) {
    throw new Error("Markmap library not loaded. Please refresh the page and try again.");
  }

  const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgElement.style.width = '100%';
  svgElement.style.height = '100%';
  mindmapDiv.appendChild(svgElement);

  const { Transformer } = window.markmap;
  const Markmap = window.markmap.Markmap;
  
  const transformer = new Transformer();
  const { root } = transformer.transform(markdown);
  
  markmapInstance = Markmap.create(svgElement, {
    autoFit: true,
    fitRatio: 0.95,
    color: (node) => {
      const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
      const selectedColor = colors[node.depth % colors.length];
      console.log(`Node depth: ${node.depth}, Selected color: ${selectedColor}`);
      return selectedColor;
    }
  }, root);
  
  setTimeout(() => {
    try {
      markmapInstance.fit();
    } catch (fitError) {
      console.warn("Fit error:", fitError);
    }
  }, 100);
} catch (error) {
  console.error("Markmap creation error:", error);
  mindmapDiv.innerHTML = `<div class="error">Error creating mindmap: ${error.message}</div>`;
}

function exportMindMap() {
  const mindmapDiv = document.getElementById("mindmap");
  const svg = mindmapDiv.querySelector('svg');

  if (!svg || !markmapInstance) {
    alert("Generate a mind map first.");
    return;
  }

  try {
    // Temporarily remove height constraint to allow SVG to expand
    mindmapDiv.classList.add('full-size');

    // Create a temporary clone of the mindmap div to avoid modifying the visible one
    const tempDiv = mindmapDiv.cloneNode(true);
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.transform = 'none';
    tempDiv.style.transformOrigin = '0 0';
    tempDiv.style.width = 'auto';
    tempDiv.style.height = 'auto';
    document.body.appendChild(tempDiv);

    let width = 800;
    let height = 600;

    const tempSvg = tempDiv.querySelector('svg');
    if (tempSvg) {
      tempSvg.style.width = 'auto';
      tempSvg.style.height = 'auto';

      const { Transformer } = window.markmap;
      const Markmap = window.markmap.Markmap;
      const transformer = new Transformer();
      const { root } = transformer.transform(tempSvg.__data__);
      const tempMarkmap = Markmap.create(tempSvg, {
        autoFit: true,
        color: (node) => {
          const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
          return colors[node.depth % colors.length];
        }
      }, root);

      tempMarkmap.fit();

      const g = tempSvg.querySelector('g');
      if (g) {
        g.removeAttribute('transform');
      }

      const bbox = tempSvg.getBBox();
      const padding = 40;
      width = bbox.width + padding;
      height = bbox.height + padding;

      tempSvg.setAttribute('width', width);
      tempSvg.setAttribute('height', height);
      tempSvg.setAttribute('viewBox', `${bbox.x - padding/2} ${bbox.y - padding/2} ${width} ${height}`);
    } else {
      throw new Error("Temporary SVG element not found.");
    }

    let scale = 2;
    const maxCanvasDimension = 16384;
    const targetMaxDimension = 3000;

    let exportWidth = width;
    let exportHeight = height;
    if (width > targetMaxDimension || height > targetMaxDimension) {
      const aspectRatio = width / height;
      if (width > height) {
        exportWidth = targetMaxDimension;
        exportHeight = exportWidth / aspectRatio;
      } else {
        exportHeight = targetMaxDimension;
        exportWidth = exportHeight * aspectRatio;
      }
      scale = 2;
      console.log(`Diagram dimensions (${width}x${height}) exceed target maximum (${targetMaxDimension}). Downscaling to ${Math.round(exportWidth)}x${Math.round(exportHeight)} to reduce file size.`);
    }

    let pixelWidth = exportWidth * scale;
    let pixelHeight = exportHeight * scale;
    if (pixelWidth > maxCanvasDimension || pixelHeight > maxCanvasDimension) {
      const maxScale = Math.min(
        maxCanvasDimension / exportWidth,
        maxCanvasDimension / exportHeight
      );
      scale = Math.floor(maxScale * 10) / 10;
      if (scale < 1) scale = 1;
      pixelWidth = exportWidth * scale;
      pixelHeight = exportHeight * scale;
      console.log(`Downscaled dimensions (${exportWidth}x${exportHeight}) still exceed canvas limits. Reducing scale to ${scale}.`);
    }

    const estimatedFileSizeMB = (pixelWidth * pixelHeight * 3) / (1024 * 1024);
    console.log(`Estimated PNG file size: ${estimatedFileSizeMB.toFixed(2)} MB.`);

    html2canvas(tempDiv, {
      backgroundColor: '#ffffff',
      scale: scale,
      useCORS: true,
      width: exportWidth,
      height: exportHeight,
      logging: true,
      onclone: (document, element) => {
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(style => {
          element.appendChild(style.cloneNode(true));
        });
      }
    }).then(canvas => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const link = document.createElement('a');
      link.download = `mindmap-${document.getElementById("topic").value || "untitled"}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);

      const devicePixelRatio = window.devicePixelRatio || 1;
      if (devicePixelRatio > 1) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width * devicePixelRatio;
        tempCanvas.height = canvas.height * devicePixelRatio;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.scale(devicePixelRatio, devicePixelRatio);
        tempCtx.drawImage(canvas, 0, 0);
        link.href = tempCanvas.toDataURL('image/png', 1.0);
      }

      link.click();

      document.body.removeChild(tempDiv);
      mindmapDiv.classList.remove('full-size');
    }).catch(err => {
      console.error("html2canvas error:", err);
      alert("Failed to export as PNG. Try again or use a screenshot tool.");
      document.body.removeChild(tempDiv);
      mindmapDiv.classList.remove('full-size');
    });
  } catch (err) {
    console.error("Export error:", err);
    alert("Failed to export as PNG. Try again or use a screenshot tool.");
    mindmapDiv.classList.remove('full-size');
  }
}

function exportMindMapAsSVG() {
  const mindmapDiv = document.getElementById("mindmap");
  const svg = mindmapDiv.querySelector('svg');

  if (!svg || !markmapInstance) {
    alert("Generate a mind map first.");
    return;
  }

  try {
    mindmapDiv.classList.add('full-size');

    const tempDiv = mindmapDiv.cloneNode(true);
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = 'auto';
    tempDiv.style.height = 'auto';
    document.body.appendChild(tempDiv);

    const clonedSvg = tempDiv.querySelector('svg');
    if (clonedSvg) {
      clonedSvg.style.width = 'auto';
      clonedSvg.style.height = 'auto';

      const { Transformer } = window.markmap;
      const Markmap = window.markmap.Markmap;
      const transformer = new Transformer();
      const { root } = transformer.transform(clonedSvg.__data__);
      const tempMarkmap = Markmap.create(clonedSvg, {
        autoFit: true,
        color: (node) => {
          const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
          return colors[node.depth % colors.length];
        }
      }, root);

      tempMarkmap.fit();

      const g = clonedSvg.querySelector('g');
      if (g) {
        g.removeAttribute('transform');
      }

      const bbox = clonedSvg.getBBox();
      const padding = 200;
      const contentWidth = bbox.width;
      const contentHeight = bbox.height;

      const displayWidth = 800;
      const displayHeight = 600;

      clonedSvg.setAttribute('width', displayWidth);
      clonedSvg.setAttribute('height', displayHeight);

      const viewBoxPaddingRightBottom = Math.max(contentWidth, contentHeight) * 0.5;
      clonedSvg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${contentWidth + viewBoxPaddingRightBottom} ${contentHeight + viewBoxPaddingRightBottom}`);

      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      clonedSvg.style.width = '100%';
      clonedSvg.style.height = 'auto';
      clonedSvg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    } else {
      throw new Error("Cloned SVG element not found.");
    }

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(clonedSvg);

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const link = document.createElement('a');
    link.download = `mindmap-${document.getElementById("topic").value || "untitled"}.svg`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
    document.body.removeChild(tempDiv);
    mindmapDiv.classList.remove('full-size');
  } catch (err) {
    console.error("SVG export error:", err);
    alert("Failed to export as SVG. Try again or use a screenshot tool.");
    mindmapDiv.classList.remove('full-size');
  }
}
