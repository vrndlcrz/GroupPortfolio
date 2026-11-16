(() => {
  // Coordinates and sizes are percentages of the visible leaf, indexed by spread.
  const SKETCH_LAYOUT = {
    2: [{ name: 'stars', x: 18, y: 16, size: 23, rot: -8 }, { name: 'sampaguita', x: 46, y: 65, size: 32, rot: 8 }],
    3: [{ name: 'laptop', x: 20, y: 35, size: 48, rot: -9 }, { name: 'hearts', x: 55, y: 23, size: 19, rot: 12 }],
    4: [{ name: 'controller', x: 12, y: 28, size: 40, rot: 7 }, { name: 'headphones', x: 46, y: 60, size: 30, rot: -12 }],
    5: [{ name: 'keyboard', x: 14, y: 49, size: 52, rot: 5 }, { name: 'coffee', x: 59, y: 20, size: 22, rot: -5 }],
    6: [{ name: 'rocket', x: 30, y: 33, size: 40, rot: 12 }, { name: 'stars', x: 63, y: 17, size: 17, rot: 6 }],
    7: [{ name: 'jeepney', x: 12, y: 28, size: 64, rot: -4 }, { name: 'mango', x: 53, y: 66, size: 22, rot: 14 }],
    8: [{ name: 'music', x: 23, y: 19, size: 31, rot: -9 }, { name: 'hearts', x: 48, y: 60, size: 29, rot: 5 }]
  };
  // Each entry has an ink outline, detail strokes, and a marker wash.
  const shapes = {
    keyboard: ['M5 17h53l-2 27H4z','M10 23h4m3 0h4m3 0h4m3 0h4m3 0h4m3 0h6M10 30h5m3 0h5m3 0h5m3 0h5m3 0h8M17 37h25','#d5e4df'],
    controller: ['M18 19q-8-3-13 18t14 3l6-6h13l6 7q16 13 12-6t-15-16q-11 4-23 0z','M14 27v10m-5-5h10m23-5h2m4 6h2','#eacddd'],
    coffee: ['M12 26h30v8q-1 14-15 14T12 34z','M43 28q15-3 7 9l-8 2M8 50q20 6 40 0M22 22q-10-7 2-13m7 13q-9-6 4-16','#f0c3a5'],
    laptop: ['M13 10h38v29H12zM12 39h39l9 9H3z','M18 15h28v18H18zM25 44h12','#d0deec'],
    headphones: ['M8 37V26a23 23 0 0 1 46 0v11h-5V26a18 18 0 0 0-36 0v11z','M9 31q9-4 10 4v12q-9 5-11-2zM53 31q-9-4-10 4v12q9 5 11-2z','#eed096'],
    rocket: ['M19 35Q29 10 55 7q-1 24-25 37z','M38 23a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 29l-11 1-5 9 13-4m14 7-1 10-10 5 5-13m-11-4-7 11 12-6','#f5ca9a'],
    stars: ['M23 7l5 12 14 1-11 9 3 14-12-7-12 7 4-14-10-9 14-1z','M47 36l2 6 7 1-5 4 1 6-5-3-5 3 2-6-5-4 6-1z','#f6d067'],
    hearts: ['M30 45Q2 28 9 17q9-12 21 3 11-16 21-4 8 11-21 29z','M14 20q2-4 6-3','#edabb3'],
    music: ['M20 39V16l26-6v24h-4V17l-18 4v17q0 9-9 10-11 1-8-5 3-6 13-4z','M42 34q-11-2-12 5t12 1q4-2 4-6','#c0b4da'],
    jeepney: ['M5 26l5-10h35l9 10 5 3v14H4z','M9 25h41M16 18v7m10-7v7m10-7v7M8 31h30m6 0h9M11 44a5 5 0 1 0 10 0m20 0a5 5 0 1 0 10 0M9 13h35','#edbd83'],
    mango: ['M38 16q20 2 12 21T19 50Q4 48 14 37t10-15q4-8 14-6z','M35 16q-1-8 6-12m-4 8Q24 1 19 8q7 9 17 5M16 43q2 5 9 4','#f4ce65'],
    sampaguita: ['M29 24q-13-23-18-10-2 7 10 15-24-7-19 6 3 7 21 3-13 18-1 19 7 0 10-17 9 21 17 12 4-6-8-17 22 2 18-10-4-6-20 0 4-21-6-18-7 2-4 17z','M26 31q5-8 10-1t-6 7z','#fff8d9']
  };
  let serial = 0;
  function get(name) {
    if (!Object.hasOwn(shapes, name)) return '';
    const [outline, details, wash] = shapes[name];
    const id = 'pencil-wobble-' + ++serial;
    return `<svg aria-hidden="true" viewBox="0 0 64 64"><defs><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence baseFrequency=".09" numOctaves="2" seed="4" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.3"/></filter></defs><g filter="url(#${id})" stroke="#34312e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="${outline}" fill="${wash}"/><path pathLength="1" d="${details}" fill="none"/></g></svg>`;
  }
  window.Sketches = { get, SKETCH_LAYOUT };
})();
