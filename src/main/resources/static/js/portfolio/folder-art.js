// One shared canvas supplies John's 3D folder and opened cover from the attached AET aesthetic image.
const JohnFolderArt = (() => {
  const cache = new Map();
  return {
    get(member) {
      const key = member.name + '|' + member.section;
      if (cache.has(key)) return cache.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1536;
      canvas.textContent = 'Application and Emerging Technologies - John Vernie Dela Cruz';
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 1024, 1536);
      const texture = window.THREE ? new THREE.CanvasTexture(canvas) : null;
      if (texture) texture.anisotropy = 4;
      const entry = { canvas, texture };
      cache.set(key, entry);

      const coverImg = new Image();
      coverImg.crossOrigin = 'anonymous';
      const drawCover = () => {
        if (coverImg.naturalWidth) {
          ctx.drawImage(coverImg, 0, 0, 1024, 1536);
          // Draw the corrected subject over the cover image's printed lettering.
          ctx.save();
          ctx.scale(canvas.width / 764, canvas.height / 1024);
          ctx.fillStyle = '#1E1E1D';
          ctx.fillRect(202, 369, 425, 60);
          ctx.fillRect(201, 435, 454, 64);
          ctx.fillRect(197, 504, 518, 57);
          ctx.font = '900 50px Georgia, serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#EBF6FA';
          ctx.fillStyle = '#2A638A';
          for (const [line, y, width] of [
            ['APPLICATION AND', 422, 419], ['EMERGING', 490, 446], ['TECHNOLOGIES', 553, 508]
          ]) {
            ctx.strokeText(line, 207, y, width);
            ctx.fillText(line, 207, y, width);
          }
          ctx.restore();
        }
        if (texture) texture.needsUpdate = true;
      };
      coverImg.onload = drawCover;
      coverImg.src = 'assets/textures/john-cover.jpg';
      if (coverImg.complete && coverImg.naturalWidth) drawCover();

      entry.ready = Promise.resolve(entry);
      return entry;
    }
  };
})();

