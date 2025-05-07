// Store the Markmap instance globally to access it during export
let markmapInstance = null;

async function generateMindMap() {
  const topic = document.getElementById("topic").value.trim();
  const api = document.getElementById("api").value;
  const mindmapDiv = document.getElementById("mindmap");

  if (!topic) {
    alert("Please enter a topic.");
    return;
  }

  // Show loading indicator
  mindmapDiv.innerHTML = "<div class='loading'>Generating mindmap...</div>";

  let markdown;

  if (api === "Mock") {
    markdown = `
# ${topic}
## Category 1
### Subitem 1
### Subitem 2
## Category 2
### Subitem 3
### Subitem 4
    `;
  } else {
    try {
      const response = await fetch("http://localhost:3000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, api }),
      });
      const data = await response.json();
      if (data.error) {
        alert("Error: " + data.error);
        return;
      }
      markdown = data.markdown;
    } catch (err) {
      console.error(err);
      alert("Failed to fetch from backend.");
      return;
    }
  }

  // Clear loading indicator
  mindmapDiv.innerHTML = "";

  try {
    // Create an SVG element for the markmap
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.style.width = '100%';
    svgElement.style.height = '100%';
    mindmapDiv.appendChild(svgElement);

    // Create markmap
    const { Transformer } = window.markmap;
    const Markmap = window.markmap.Markmap; // Direct access from window.markmap
    
    const transformer = new Transformer();
    const { root } = transformer.transform(markdown);
    
    // Create the markmap and store the instance
    markmapInstance = Markmap.create(svgElement, {
      autoFit: true,
      fitRatio: 0.95, // Slightly reduce fit ratio to avoid overflow
      color: (node) => {
        // Generate different colors for different levels
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
        return colors[node.depth % colors.length];
      }
    }, root);
    
    // Fit the markmap to the container
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
    tempDiv.style.left = '-9999px'; // Move off-screen
    tempDiv.style.transform = 'none'; // Reset any zoom or transform
    tempDiv.style.transformOrigin = '0 0';
    tempDiv.style.width = 'auto'; // Let it expand naturally
    tempDiv.style.height = 'auto'; // Let it expand naturally
    document.body.appendChild(tempDiv);

    // Initialize width and height with fallback values
    let width = 800; // Fallback width
    let height = 600; // Fallback height

    // Get the temporary SVG and calculate dimensions
    const tempSvg = tempDiv.querySelector('svg');
    if (tempSvg) {
      // Reset SVG styles to ensure full size
      tempSvg.style.width = 'auto';
      tempSvg.style.height = 'auto';

      // Re-create the Markmap instance on the temporary SVG to ensure proper rendering
      const { Transformer } = window.markmap;
      const Markmap = window.markmap.Markmap;
      const transformer = new Transformer();
      const { root } = transformer.transform(tempSvg.__data__); // Use the same data as the original SVG
      const tempMarkmap = Markmap.create(tempSvg, {
        autoFit: true,
        color: (node) => {
          const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
          return colors[node.depth % colors.length];
        }
      }, root);

      // Ensure the temporary Markmap fits all content (resets zoom)
      tempMarkmap.fit();

      // Explicitly reset any transformations on the root <g> element
      const g = tempSvg.querySelector('g');
      if (g) {
        g.removeAttribute('transform'); // Remove any zoom/pan transformations
      }

      // Calculate dimensions after fitting
      const bbox = tempSvg.getBBox();
      const padding = 40;
      width = bbox.width + padding;
      height = bbox.height + padding;

      // Set SVG dimensions and viewBox
      tempSvg.setAttribute('width', width);
      tempSvg.setAttribute('height', height);
      tempSvg.setAttribute('viewBox', `${bbox.x - padding/2} ${bbox.y - padding/2} ${width} ${height}`);
    } else {
      throw new Error("Temporary SVG element not found.");
    }

    // Calculate an appropriate scale to balance quality and file size
    let scale = 2;
    const maxCanvasDimension = 16384; // Typical browser canvas size limit (e.g., Chrome)
    const targetMaxDimension = 3000;

    // Downscale dimensions to keep file size manageable
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
      scale = 2; // Keep scale consistent after downscaling
      console.log(`Diagram dimensions (${width}x${height}) exceed target maximum (${targetMaxDimension}). Downscaling to ${Math.round(exportWidth)}x${Math.round(exportHeight)} to reduce file size.`);
    }

    // Check canvas size limits after downscaling
    let pixelWidth = exportWidth * scale;
    let pixelHeight = exportHeight * scale;
    if (pixelWidth > maxCanvasDimension || pixelHeight > maxCanvasDimension) {
      const maxScale = Math.min(
        maxCanvasDimension / exportWidth,
        maxCanvasDimension / exportHeight
      );
      scale = Math.floor(maxScale * 10) / 10; // Round down to 1 decimal place
      if (scale < 1) scale = 1; // Ensure minimum scale of 1
      pixelWidth = exportWidth * scale;
      pixelHeight = exportHeight * scale;
      console.log(`Downscaled dimensions (${exportWidth}x${exportHeight}) still exceed canvas limits. Reducing scale to ${scale}.`);
    }

    // Estimate file size (rough approximation: ~3 bytes per pixel for PNG)
    const estimatedFileSizeMB = (pixelWidth * pixelHeight * 3) / (1024 * 1024); // Bytes to MB
    console.log(`Estimated PNG file size: ${estimatedFileSizeMB.toFixed(2)} MB.`);

    // Use html2canvas to capture the temporary div
    html2canvas(tempDiv, {
      backgroundColor: '#ffffff', // Ensure white background
      scale: scale, // Dynamically adjusted scale
      useCORS: true, // Handle cross-origin issues if any
      width: exportWidth, // Use downscaled width
      height: exportHeight, // Use downscaled height
      logging: true, // Enable logging for debugging
      onclone: (document, element) => {
        // Ensure fonts and styles are applied in the cloned document
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(style => {
          element.appendChild(style.cloneNode(true));
        });
      }
    }).then(canvas => {
      // Optimize canvas rendering for sharpness
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; // Reduce blurriness

      // Create a download link for the PNG
      const link = document.createElement('a');
      link.download = `mindmap-${document.getElementById("topic").value || "untitled"}.png`;
      link.href = canvas.toDataURL('image/png', 1.0); // Quality setting (1.0 = maximum)

      // Adjust for device pixel ratio to ensure sharpness on high-DPI displays
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

      // Clean up: remove temporary div and restore original div
      document.body.removeChild(tempDiv);
      mindmapDiv.classList.remove('full-size');
    }).catch(err => {
      console.error("html2canvas error:", err);
      alert("Failed to export as PNG. Try again or use a screenshot tool.");
      // Clean up
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
    // Temporarily remove height constraint to allow SVG to expand
    mindmapDiv.classList.add('full-size');

    // Create a temporary clone of the mindmap div to avoid modifying the original
    const tempDiv = mindmapDiv.cloneNode(true);
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px'; // Move off-screen
    tempDiv.style.width = 'auto';
    tempDiv.style.height = 'auto';
    document.body.appendChild(tempDiv);

    // Get the temporary SVG
    const clonedSvg = tempDiv.querySelector('svg');
    if (clonedSvg) {
      // Reset SVG styles to ensure full size
      clonedSvg.style.width = 'auto';
      clonedSvg.style.height = 'auto';

      // Re-create the Markmap instance on the cloned SVG to ensure proper rendering
      const { Transformer } = window.markmap;
      const Markmap = window.markmap.Markmap;
      const transformer = new Transformer();
      const { root } = transformer.transform(clonedSvg.__data__); // Use the same data as the original SVG
      const tempMarkmap = Markmap.create(clonedSvg, {
        autoFit: true,
        color: (node) => {
          const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
          return colors[node.depth % colors.length];
        }
      }, root);

      // Ensure the temporary Markmap fits all content (resets zoom)
      tempMarkmap.fit();

      // Explicitly reset any transformations on the root <g> element
      const g = clonedSvg.querySelector('g');
      if (g) {
        g.removeAttribute('transform'); // Remove any zoom/pan transformations
      }

      // Calculate dimensions after fitting
      const bbox = clonedSvg.getBBox();
      const padding = 200; // Base padding
      const contentWidth = bbox.width;
      const contentHeight = bbox.height;

      // Set smaller SVG dimensions for initial display
      const displayWidth = 800; // Smaller initial width
      const displayHeight = 600; // Smaller initial height

      // Set SVG dimensions
      clonedSvg.setAttribute('width', displayWidth);
      clonedSvg.setAttribute('height', displayHeight);

      // Set viewBox to include the full content with padding on right and bottom
      const viewBoxPaddingRightBottom = Math.max(contentWidth, contentHeight) * 0.5; // Padding for right and bottom
      clonedSvg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${contentWidth + viewBoxPaddingRightBottom} ${contentHeight + viewBoxPaddingRightBottom}`);

      // Ensure XML namespace is present
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Align the diagram at the top-left
      clonedSvg.style.width = '100%';
      clonedSvg.style.height = 'auto';
      clonedSvg.setAttribute('preserveAspectRatio', 'xMinYMin meet'); // Align to top-left
    } else {
      throw new Error("Cloned SVG element not found.");
    }

    // Serialize the SVG to a string
    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(clonedSvg);

    // Create a Blob for the SVG
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create a download link
    const link = document.createElement('a');
    link.download = `mindmap-${document.getElementById("topic").value || "untitled"}.svg`;
    link.href = url;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(tempDiv);
    mindmapDiv.classList.remove('full-size');
  } catch (err) {
    console.error("SVG export error:", err);
    alert("Failed to export as SVG. Try again or use a screenshot tool.");
    mindmapDiv.classList.remove('full-size');
  }
}