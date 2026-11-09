/* Vaishnava Texts: one icon set. Every glyph sits on a 24 px grid, 1.9 px round strokes in currentColor, so icons
   follow the theme and accent. Glyphs not drawn here fall back to the artwork table in assets.js (same grid and stroke). */
'use strict';
(function (GB) {
  const S = body => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  const HEART = 'M12 20.2c-.3 0-.6-.1-.8-.3C6.4 15.8 3.2 12.9 3.2 9.2A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.8 2.3c0 3.7-3.2 6.6-8 10.7-.2.2-.5.3-.8.3z';
  const P = {
    // tabs
    lib: '<path d="M4 19.5V6.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2v13.3"/><path d="M9 19.5V4.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2v15.3"/><path d="M15.2 7.3l2.5-.7c.6-.2 1.3.2 1.5.9l2.7 10.4"/><path d="M2.5 20.5h19"/><path d="M4 9h5M9 8h5"/>',
    notebook: '<path d="M6 3.5h11.5c.8 0 1.5.7 1.5 1.5v14c0 .8-.7 1.5-1.5 1.5H6z"/><path d="M6 3.5v17M3.8 7.5H6M3.8 12H6M3.8 16.5H6"/><path d="M10 8.5h5.5M10 12h4"/>',
    sidebar: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9.5 4.5v15"/><path d="M5.5 8h1.8M5.5 11h1.8"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L20.5 20.5"/>',
    // verse actions
    heart: '<path d="' + HEART + '"/>',
    heartOn: '<path d="' + HEART + '" fill="currentColor"/>',
    lang: '<path d="M3 6.5h8M7 4v2.5M9.6 6.5c-.6 3.6-2.8 6.4-6.1 8"/><path d="M5.4 9.7c1 1.8 2.6 3.2 4.6 4.1"/><path d="M12.5 20l3.8-9.5 3.8 9.5M13.8 17h5"/>',
    refs: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
    note: '<path d="M5 4.5h10l4 4V19.5c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1v-14c0-.6.4-1 1-1z"/><path d="M15 4.5V8.5h4M8 12.5h8M8 16h5"/>',
    share: '<path d="M12 15V3.8M7.8 8L12 3.8 16.2 8"/><path d="M8 11H6.2c-.7 0-1.2.5-1.2 1.2v6.6c0 .7.5 1.2 1.2 1.2h11.6c.7 0 1.2-.5 1.2-1.2v-6.6c0-.7-.5-1.2-1.2-1.2H16"/>',
    chev: '<path d="M6.5 9.5L12 15l5.5-5.5"/>',
    chevL: '<path d="M14.5 6L9 12l5.5 6"/>',
    chevR: '<path d="M9.5 6L15 12l-5.5 6"/>',
    aa: '<path d="M2.8 18.5L7.6 6l4.8 12.5M4.5 14.4h6.2"/><path d="M14.2 12.6c.5-1 1.5-1.6 2.8-1.6 1.8 0 3 1 3 2.8v4.7M20 15.2c-3.6-.1-5.6.7-5.6 2.1 0 1 .8 1.5 2 1.5 1.7 0 3.6-1.2 3.6-3.2"/>',
    // general
    back: '<path d="M15 5l-7 7 7 7"/>', fwd: '<path d="M9 5l7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    more: '<g fill="currentColor" stroke="none"><circle cx="12" cy="5.2" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="18.8" r="1.7"/></g>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.6 4.6L19 7.5"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4.2 4.2v4.4h4.4"/><path d="M12 8v4.3l3 1.8"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.6"/>',
    moon: '<path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.5h9.2L17.5 7M10.2 11v5.2M13.8 11v5.2"/>',
    edit: '<path d="M4 20l1-4.2L16.4 4.4a2.2 2.2 0 0 1 3.1 3.1L8.2 18.9z"/><path d="M14.4 6.4l3.2 3.2"/>',
    folder: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4l2.2 2.6h7.4A2.2 2.2 0 0 1 21 9.8v8A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/>',
    folderPlus: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4l2.2 2.6h7.4A2.2 2.2 0 0 1 21 9.8v8A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/><path d="M12 10.8v6M9 13.8h6"/>',
    file: '<path d="M6 3h8.5l4.5 4.5V21H6z"/><path d="M14.5 3v4.5H19"/>',
    upload: '<path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4.5 15.5v4h15v-4"/>',
    download: '<path d="M12 4v11.5M7.5 11L12 15.5l4.5-4.5"/><path d="M4.5 15.5v4h15v-4"/>',
    offline: '<path d="M7 18a4.2 4.2 0 0 1-.6-8.3A5.6 5.6 0 0 1 17 9.3a4.4 4.4 0 0 1 .5 8.7z"/><path d="M9.3 13.6l2 2 3.6-3.8"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    swap: '<path d="M4 8h15M15 4.5L19 8l-4 3.5M20 16H5M9 12.5L5 16l4 3.5"/>',
    sync: '<path d="M19.5 9A8 8 0 0 0 5.6 6.6M4.5 3.5v4h4M4.5 15a8 8 0 0 0 13.9 2.4M19.5 20.5v-4h-4"/>',
    link: '<path d="M10 14a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1"/><path d="M14 10a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>',
    marker: '<path d="M15.2 3.8l5 5-9.4 9.4H5.8v-5z"/><path d="M13 6l5 5"/><path d="M3.5 21h17"/>',
    comment: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>',
    quest: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M9.8 8.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5M12 14.4v.1"/>',
    quote: '<path d="M4.5 18.5c0-4.6 1.6-7.6 5.4-9.2v2.6c-1.9.9-2.7 2.1-2.7 3.4h2.7v5H4.5zM13.6 18.5c0-4.6 1.6-7.6 5.4-9.2v2.6c-1.9.9-2.7 2.1-2.7 3.4H19v5h-5.4z" fill="currentColor" stroke="none"/>',
    tag: '<path d="M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5z"/><circle cx="8.3" cy="8.3" r="1.3"/>',
    star: '<path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/>',
    vertical: '<rect x="6.5" y="3" width="11" height="18" rx="2"/><path d="M12 7v10M9.8 9.2L12 7l2.2 2.2M9.8 14.8L12 17l2.2-2.2"/>',
    horizontal: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 12h10M9.2 9.8L7 12l2.2 2.2M14.8 9.8L17 12l-2.2 2.2"/>',
    scroll: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 7.5h8M8 11h8M8 14.5h8M8 18h5"/>',
    single: '<rect x="5.5" y="3.5" width="13" height="17" rx="2"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.4"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M3.5 17.5l5-4.5 3.5 3 3-2.5 5.5 4.5"/>',
    font: '<path d="M3.5 19L9 5.5l5.5 13.5M5.4 14.4h7.2"/><path d="M15.5 19l3-7.5 3 7.5M16.6 16.4h3.8"/>',
    book: '<path d="M12 6.6C10 5 7 4.5 3.5 5v13.6c3.5-.5 6.5 0 8.5 1.6 2-1.6 5-2.1 8.5-1.6V5C17 4.5 14 5 12 6.6zM12 6.6v13.6"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><g fill="currentColor" stroke="none"><circle cx="4.8" cy="6.5" r="1.3"/><circle cx="4.8" cy="12" r="1.3"/><circle cx="4.8" cy="17.5" r="1.3"/></g>',
    grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></g>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.4v.2"/>',
    db: '<ellipse cx="12" cy="5.8" rx="7.5" ry="2.8"/><path d="M4.5 5.8v12.4c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.8"/><path d="M4.5 10c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8M4.5 14.2c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    backup: '<path d="M7 17.5a4.2 4.2 0 0 1-.6-8.3A5.6 5.6 0 0 1 17 8.8a4.4 4.4 0 0 1 .5 8.7"/><path d="M12 20.5v-8M8.8 15.5l3.2-3.2 3.2 3.2"/>',
    restore: '<path d="M7 17.5a4.2 4.2 0 0 1-.6-8.3A5.6 5.6 0 0 1 17 8.8a4.4 4.4 0 0 1 .5 8.7"/><path d="M12 12.5v8M8.8 17.5l3.2 3.2 3.2-3.2"/>',
    sanskrit: '<path d="M4 7h16M9.5 7v12M9.5 12.2c-2.8-1.6-5 .4-4.6 3 .4 2.3 3 3.2 4.6 2.4M15 7v12"/>',
    wbw: '<path d="M4 7h6M4 12h4M4 17h6M14 7h6M14 12h6M14 17h4"/>',
    drawer: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    goto: '<path d="M4 12h12M12 6.5l5.5 5.5-5.5 5.5"/><path d="M20.5 4.5v15"/>',
    export: '<path d="M14 3.5H6.5c-.8 0-1.5.7-1.5 1.5v14c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V8.5z"/><path d="M14 3.5v5h5M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
    print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.6"/><path d="M7 14h10v6.5H7z"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.7-.8 1.7-1.6 0-1.2-1-1.5-1-2.5 0-.8.7-1.4 1.5-1.4h2.1c2.3 0 4.2-1.8 4.2-4.2 0-4-3.8-7.3-8.5-7.3z"/><g fill="currentColor" stroke="none"><circle cx="7.8" cy="11" r="1.2"/><circle cx="10.2" cy="7.5" r="1.2"/><circle cx="14.6" cy="7.6" r="1.2"/></g>'
  };
  GB.icons = {
    svg: name => P[name] ? S(P[name]) : (GB.artwork && GB.artwork.glyph(name)) || '',
    has: name => !!P[name] || !!(GB.artwork && GB.artwork.glyph(name))
  };
})(window.GB);
