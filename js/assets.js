/* Vaishnava Texts: own artwork. Every icon, logo and picture the app shows is drawn here as SVG; nothing is loaded
   from image files. GB.asset(url) maps the app's image names (img/ui/ic_*.png ...) to data: URIs, and the two setters
   below make every <img> go through it, so the rest of the code keeps asking for names. */
'use strict';
(function (GB) {
  const night = () => !!(GB.prefs && GB.prefs.night);
  // inks: one colour, or [light theme, dark theme]
  const C = { or: ['ACC', 'ACCN'], hd: '#e2c47e', star: '#e0a526', green: '#6f9a3a', blue: '#4f84ad', red: '#b83a32', yellow: '#e8bd3a', folder: '#c9a14a', cream: '#efe8d6', white: '#ffffff',
    tx: ['ACC', 'ACCN'], mut: ['#7b8580', '#8e9a92'], ink: ['#22423a', '#e2c47e'], rib: ['#c18b2f', '#d8b35e'] };
  const ray = (n, r1, r2, cx, cy, a0) => { let d = ''; for (let i = 0; i < n; i++) { const a = (a0 || 0) + i * 2 * Math.PI / n, c = Math.cos(a), s = Math.sin(a); d += 'M' + (cx + r1 * c).toFixed(2) + ' ' + (cy + r1 * s).toFixed(2) + 'L' + (cx + r2 * c).toFixed(2) + ' ' + (cy + r2 * s).toFixed(2); } return d; };
  // ---- stroke glyphs on a 24 grid; '@' is replaced by the ink ----
  const G = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
    more: '<g fill="@" stroke="none"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></g>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    closeCircle: '<circle cx="12" cy="12" r="10"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
    caret: '<path d="M6 9.5h12L12 16.5z" fill="@" stroke="none"/>',
    goCircle: '<circle cx="12" cy="12" r="9.5"/><path d="M10 7.5l4.5 4.5-4.5 4.5"/>',
    swap: '<path d="M4 8h15M15 4.5L19 8l-4 3.5M20 16H5M9 12.5L5 16l4 3.5"/>',
    sync: '<path d="M19.5 9A8 8 0 0 0 5.6 6.6M4.5 3.5v4h4M4.5 15a8 8 0 0 0 13.9 2.4M19.5 20.5v-4h-4"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4.2 4.2v4.4h4.4"/><path d="M12 8v4.3l3 1.8"/>',
    bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.3-6 4.3v-16a1 1 0 0 1 1-1z"/>',
    bmOpen: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.3-6 4.3v-16a1 1 0 0 1 1-1z"/><path d="M10.6 8.5l3 3-3 3"/>',
    bmX: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.3-6 4.3v-16a1 1 0 0 1 1-1z"/><path d="M9.8 8l4.4 4.4M14.2 8l-4.4 4.4"/>',
    bmFill: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.3-6 4.3v-16a1 1 0 0 1 1-1z" fill="@"/>',
    ribbon: '<path d="M6 3h12v18l-6-4.6L6 21z" fill="@" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="' + ray(8, 8.2, 10.6, 12, 12, Math.PI / 8) + '"/>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.4v.2"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="' + ray(8, 7, 9.6, 12, 12, 0) + '"/>',
    moon: '<path d="M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z"/>',
    fontUp: '<path d="M3.5 19L9 5.5l5.5 13.5M5.4 14.4h7.2"/><path d="M18 5v6M15 8h6"/>',
    fontDown: '<path d="M3.5 19L9 5.5l5.5 13.5M5.4 14.4h7.2"/><path d="M15 8h6"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><g fill="@" stroke="none"><circle cx="4.8" cy="6.5" r="1.3"/><circle cx="4.8" cy="12" r="1.3"/><circle cx="4.8" cy="17.5" r="1.3"/></g>',
    books: '<rect x="3" y="6" width="4.6" height="14" rx="1.2"/><rect x="8.8" y="3.5" width="4.6" height="16.5" rx="1.2"/><path d="M15.2 7.4l4.3-1.1 3 12.8-4.3 1.1z"/>',
    skt: '<path d="M4 7h16M9.5 7v12M9.5 12.2c-2.8-1.6-5 .4-4.6 3 .4 2.3 3 3.2 4.6 2.4M15 7v12"/>',
    comment: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>',
    columns: '<rect x="3" y="4" width="8" height="16" rx="1.8"/><rect x="13" y="4" width="8" height="16" rx="1.8"/><path d="M5.8 9h2.4M5.8 12.5h2.4M15.8 9h2.4M15.8 12.5h2.4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3.4 3.2-3.4 14.8 0 18M12 3c3.4 3.2 3.4 14.8 0 18"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>',
    quote: '<path d="M4.5 18.5c0-4.6 1.6-7.6 5.4-9.2v2.6c-1.9.9-2.7 2.1-2.7 3.4h2.7v5H4.5zM13.6 18.5c0-4.6 1.6-7.6 5.4-9.2v2.6c-1.9.9-2.7 2.1-2.7 3.4H19v5h-5.4z" fill="@" stroke="none"/>',
    speaker: '<path d="M3.5 9.5v5H7l5 4v-13l-5 4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    link: '<path d="M10 14a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1"/><path d="M14 10a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1"/>',
    openNew: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    sliders: '<path d="M4 7h8M18 7h2M4 12h2M12 12h8M4 17h9M19 17h1"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="16" cy="17" r="2.2"/>',
    cloudUp: '<path d="M7 17.5a4.2 4.2 0 0 1-.6-8.3A5.6 5.6 0 0 1 17 8.8a4.4 4.4 0 0 1 .5 8.7"/><path d="M12 20.5v-8M8.8 15.5l3.2-3.2 3.2 3.2"/>',
    cloudDown: '<path d="M7 17.5a4.2 4.2 0 0 1-.6-8.3A5.6 5.6 0 0 1 17 8.8a4.4 4.4 0 0 1 .5 8.7"/><path d="M12 12.5v8M8.8 17.5l3.2 3.2 3.2-3.2"/>',
    pencil: '<path d="M4 20l1-4.2L16.4 4.4a2.2 2.2 0 0 1 3.1 3.1L8.2 18.9z"/><path d="M14.4 6.4l3.2 3.2"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.5h9.2L17.5 7M10.2 11v5.2M13.8 11v5.2"/>',
    notePlus: '<path d="M6 3h8.5l4.5 4.5V21H6z"/><path d="M14.5 3v4.5H19M12 11.5v6M9 14.5h6"/>',
    note: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14.5 3.5V8H19M9 12.5h7M9 16.5h5"/>',
    qmark: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.6a2.8 2.8 0 1 1 4 2.5c-.9.5-1.3 1-1.3 1.9v.4M12 17.2v.2"/>',
    qPlus: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.6a2.8 2.8 0 1 1 4 2.5c-.9.5-1.3 1-1.3 1.9v.4M12 17.2v.2"/>',
    marker: '<path d="M15.2 3.8l5 5-9.4 9.4H5.8v-5z"/><path d="M13 6l5 5"/><path d="M3.5 21h17" stroke-width="2.6" opacity=".55"/>',
    star: '<path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z" fill="@"/>',
    sticky: '<path d="M4 4h16v11l-5 5H4z" fill="@" fill-opacity=".28"/><path d="M15 20v-5h5M8 9h8M8 12.5h5"/>',
    folder: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4l2.2 2.6h7.4A2.2 2.2 0 0 1 21 9.8v8A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z" fill="@" fill-opacity=".3"/>',
    folderSubs: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4l2.2 2.6h7.4A2.2 2.2 0 0 1 21 9.8v8A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z" fill="@" fill-opacity=".3"/><path d="M7.5 13h9M7.5 16.2h6"/>',
    folderPlus: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4l2.2 2.6h7.4A2.2 2.2 0 0 1 21 9.8v8A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/><path d="M12 10.8v6M9 13.8h6"/>',
    picture: '<rect x="3" y="4.5" width="18" height="15" rx="2.4"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M3.5 17.5l5-4.5 3.5 3 3-2.5 5.5 4.5"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.4"/><g fill="@" stroke="none"><circle cx="8.3" cy="8.3" r="1.5"/><circle cx="15.7" cy="8.3" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="8.3" cy="15.7" r="1.5"/><circle cx="15.7" cy="15.7" r="1.5"/></g>',
    pages: '<rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M9 10l3-3 3 3M9 14l3 3 3-3"/>',
    bookOpen: '<path d="M12 6.6C10 5 7 4.5 3.5 5v13.6c3.5-.5 6.5 0 8.5 1.6 2-1.6 5-2.1 8.5-1.6V5C17 4.5 14 5 12 6.6zM12 6.6v13.6"/>',
    stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.2M9.5 3h5M18.2 6.2l1.4-1.4"/>',
    hourglass: '<path d="M7 3.5h10M7 20.5h10M8 3.5v3a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.3A4 4 0 0 0 8 17.5v3M16 3.5v3a4 4 0 0 1-1.6 3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2v3"/>',
    eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
    garland: '<path d="M12 20.5C5.4 16 3 12.6 3 9.4A4.9 4.9 0 0 1 12 7a4.9 4.9 0 0 1 9 2.4c0 3.2-2.4 6.6-9 11.1z" stroke-width="3.1" stroke-dasharray="0 3.5"/>',
    graph: '<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="5.8" r="2.6"/><circle cx="18" cy="18.2" r="2.6"/><path d="M8.3 10.8l7.4-3.7M8.3 13.2l7.4 3.7"/>'
  };
  // ---- whole pictures ----
  const logoBody = (a, b) => '<g fill="' + a + '"><path d="M30.2 52.5C24.6 47.4 16 45.8 7 46.6V21.2c8.7-.8 17 .7 23.2 5.6z"/><path d="M33.8 52.5c5.6-5.1 14.2-6.7 23.2-5.9V21.2c-8.7-.8-17 .7-23.2 5.6z"/></g>' +
    '<circle cx="32" cy="12.5" r="4.6" fill="' + b + '"/><path d="M22 12.5h2.4M24.9 5.4l1.7 1.7M32 2.5v2.4M39.1 5.4l-1.7 1.7M39.6 12.5H42" stroke="' + b + '" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
  const svg = (vb, body, extra) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '"' + (extra || '') + '>' + body + '</svg>';
  const DOC = {
    logoHdr: () => svg('0 0 64 56', logoBody('#e2c47e', '#f6ebc8')),
    logoSplash: th => svg('0 0 64 56', th === 'dark' ? logoBody('#e2c47e', '#f3e2b2') : logoBody('#22423a', '#c18b2f')),
    appIcon: () => svg('0 0 64 64', '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2e574c"/><stop offset="1" stop-color="#173029"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#g)"/><g transform="translate(32 32) scale(.82) translate(-32 -27.5)">' + logoBody('#e6c47a', '#f8eccb') + '</g>'),
    flagEN: () => svg('0 0 30 20', '<rect x=".5" y=".5" width="29" height="19" rx="3.5" fill="#e9e1cc"/><path d="M12 6H8v8h4M8 10h3.2M16 14V6l6 8V6" fill="none" stroke="#1f3c35" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
    empty: th => { const a = th === 'dark' ? '#8e9a92' : '#22423a'; return svg('0 0 120 120', '<g fill="' + a + '" fill-opacity=".14" stroke="' + a + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><rect x="20" y="42" width="19" height="50" rx="3"/><rect x="43" y="28" width="21" height="64" rx="3"/><path d="M68 36l17.5-4.6 13 49.6-17.5 4.6z"/><path d="M12 96h96" fill="none"/></g><path d="M29.5 52v14M53.5 40v14" stroke="' + a + '" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>'); },
    seal: th => { const a = th === 'dark' ? '#d8b35e' : '#c18b2f'; return svg('0 0 64 64', '<path d="M23 40l-5 18 9-4 4 8 5-21zM41 40l5 18-9-4-4 8-5-21z" fill="' + a + '" fill-opacity=".55"/><circle cx="32" cy="26" r="19" fill="' + a + '" fill-opacity=".16" stroke="' + a + '" stroke-width="3"/><path d="M22.5 26.5l6.5 6.5 13-13.5" fill="none" stroke="' + a + '" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>'); },
    cover: th => { const d = th === 'dark'; return svg('0 0 100 125', '<defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (d ? '#24393a' : '#2e574c') + '"/><stop offset="1" stop-color="' + (d ? '#121d1f' : '#173029') + '"/></linearGradient></defs><rect width="100" height="125" rx="7" fill="url(#c)"/><rect x="6" y="6" width="88" height="113" rx="4" fill="none" stroke="#e9c46a" stroke-opacity=".7" stroke-width="1.2"/><g transform="translate(50 56) scale(.9) translate(-32 -27.5)">' + logoBody('#e2c47e', '#f6ebc8') + '</g><path d="M24 98h52M32 105h36" stroke="#e9c46a" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>'); }
  };
  // ---- the old file names -> [glyph or doc, ink] ----
  const M = {
    headermenuicon: ['doc:logoHdr'], splash_icon: ['doc:logoSplash'], gitabase_reader_icon: ['doc:appIcon'], eng: ['doc:flagEN'],
    my_books_empty: ['doc:empty'], purnam: ['doc:seal'], book_cover: ['doc:cover'],
    change_content: ['swap', C.hd], ic_change_gitabase: ['swap', C.or], ic_arrow_drop_down_28: ['caret', C.cream],
    ic_action_search: ['search', C.or], cab_search: ['search', C.or], ic_more_actions: ['more', C.or], ic_screen_manager: ['history', C.or],
    ic_bookmark: ['bookmark', C.or], ic_bookmark_open: ['bmOpen', C.or], ic_remove_bookmark: ['bmX', C.red], ic_bookmark_icon_short: ['bmFill', C.ink],
    bookmark_open: ['ribbon', C.rib], ic_plus_orange: ['plus', C.or], ic_new_topic: ['folderPlus', C.or], ic_go4seach: ['goCircle', C.tx],
    ic_go_left: ['left', C.or], ic_go_right: ['right', C.or],
    ic_page_up: ['up', C.tx], ic_page_dn: ['down', C.tx], ic_page_close: ['close', C.tx],
    ic_srch_arrow_up: ['up', C.tx], ic_srch_arrow_down: ['down', C.tx], ic_srch_arrow_cross: ['close', C.tx],
    ic_compare_swap: ['swap', C.cream], ic_compare_scroll_sync: ['sync', C.cream], ic_compare_sanskrit: ['skt', C.cream], ic_horizontal_hint_close: ['closeCircle', C.white],
    ic_menu_books: ['books', C.or], ic_menu_night: ['moon', C.or], ic_sun: ['sun', C.or], ic_menu_sanskrit: ['skt', C.or], ic_menu_list: ['list', C.or],
    ic_mmenu_settings: ['gear', C.or], ic_mmenu_about: ['info', C.or], ic_action_inct: ['fontUp', C.or], ic_menu_dec_font: ['fontDown', C.or],
    ic_random_text_o: ['dice', C.or], ic_paged_scroll: ['pages', C.or], ic_reading: ['bookOpen', C.or], ic_menu_comment: ['comment', C.or],
    ic_menu_compare: ['columns', C.or], ic_menu_translate: ['globe', C.or], ic_copy: ['copy', C.or], ic_read_aloud: ['speaker', C.or],
    ic_chapter_link: ['openNew', C.or], ic_url: ['link', C.or], ic_sysutils: ['sliders', C.or], ic_save_to_cloud: ['cloudUp', C.or], ic_open_from_cloud: ['cloudDown', C.or],
    ic_rename_o: ['pencil', C.or], ic_delete_o: ['trash', C.red], ic_menu_add_note: ['notePlus', C.or], ic_menu_add_question: ['qPlus', C.red],
    cab_highl: ['marker', C.green], cab_fav: ['star', C.star], cab_comment: ['comment', C.blue], qmark: ['qmark', C.red], ic_copy_quote: ['quote', C.or],
    ic_notes_highl: ['marker', C.green], ic_notes_fav: ['star', C.star], ic_notes_comment: ['comment', C.blue], ic_notes_qmark: ['qmark', C.red],
    ic_my_note: ['sticky', C.yellow], ic_my_question: ['qmark', C.red], star_icon: ['star', C.star], ic_folder: ['folder', C.folder], ic_folder_subs: ['folderSubs', C.folder],
    ic_images: ['picture', C.ink], ic_time1: ['stopwatch', C.mut], ic_time2: ['hourglass', C.mut], ic_icon_delete: ['trash', C.mut],
    ic_garland: ['garland', C.tx], ic_compare: ['columns', C.tx], ic_translate: ['globe', C.tx], ic_refs: ['graph', C.tx], ic_notes: ['note', C.tx],
    ic_show_wbw: ['eye', C.tx], ic_hide_wbw: ['eyeOff', C.tx]
  };
  const cache = new Map();
  function build(spec, th) {
    if (spec[0].slice(0, 4) === 'doc:') return DOC[spec[0].slice(4)](th);
    let ink = Array.isArray(spec[1]) ? spec[1][th === 'dark' ? 1 : 0] : spec[1];
    if (ink === 'ACC' || ink === 'ACCN') ink = GB.accentInk(ink === 'ACCN');
    return svg('0 0 24 24', G[spec[0]].replace(/@/g, ink), ' fill="none" stroke="' + ink + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"');
  }
  GB.asset = function (url) {
    const m = /^(?:\.\/)?img\/(?:ui|tb)\/([A-Za-z0-9_]+)\.(?:png|jpg|svg)$/.exec(String(url)); if (!m) return url;
    let base = m[1], theme = null, hdr = false; const hs = /_hdr$/.exec(base); if (hs) { hdr = true; base = base.slice(0, -4); }
    const s = /_(o|d|dark)$/.exec(base);
    if (s) { theme = s[1] === 'o' ? 'light' : 'dark'; base = base.slice(0, -s[0].length); }
    const spec0 = M[base] || M[m[1]]; const spec = spec0 && hdr && spec0[0].slice(0, 4) !== 'doc:' ? [spec0[0], C.hd] : spec0; if (!spec) { console.warn('no artwork for', url); return url; }
    const th = theme || (night() ? 'dark' : 'light'), key = m[1] + '|' + th + '|' + ((GB.prefs && GB.prefs.accent) || '');
    let out = cache.get(key);
    if (!out) { out = 'data:image/svg+xml,' + encodeURIComponent(build(spec, th)); cache.set(key, out); }
    return out;
  };
  // loading animation: the logo's book with a gilt page turning over the spine and the sun breathing above it
  const LOADER = '<svg class="gbl" viewBox="0 0 64 56" aria-hidden="true"><g class="gbl-pages"><path d="M30.2 52.5C24.6 47.4 16 45.8 7 46.6V21.2c8.7-.8 17 .7 23.2 5.6z"/><path d="M33.8 52.5c5.6-5.1 14.2-6.7 23.2-5.9V21.2c-8.7-.8-17 .7-23.2 5.6z"/></g>' +
    '<path class="gbl-turn" d="M33.8 52.5c5.6-5.1 14.2-6.7 23.2-5.9V21.2c-8.7-.8-17 .7-23.2 5.6z"/><g class="gbl-sun"><circle cx="32" cy="12.5" r="4.6"/><path d="M22 12.5h2.4M24.9 5.4l1.7 1.7M32 2.5v2.4M39.1 5.4l-1.7 1.7M39.6 12.5H42"/></g></svg>';
  GB.loader = function (cls) { const d = document.createElement('div'); d.className = 'gb-loader' + (cls ? ' ' + cls : ''); d.setAttribute('role', 'status'); d.setAttribute('aria-label', 'Loading'); d.innerHTML = LOADER; return d; };
  // placeholder rows while a chapter's texts load
  GB.skeletonRows = function (n) { const f = document.createElement('div'); f.className = 'sk-list'; for (let i = 0; i < (n || 8); i++) f.insertAdjacentHTML('beforeend', '<div class="sk-row"><i class="sk-a"></i><i class="sk-b"></i><i class="sk-c"></i></div>'); return f; };
  GB.artwork = { names: () => Object.keys(M), svg: (name, th) => { const sp = M[name]; return sp ? build(sp, th || 'light') : ''; }, doc: DOC,
    glyph: name => G[name] ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + G[name].replace(/@/g, 'currentColor') + '</svg>' : '' };
  // accents: [day ink, night ink, title bar day, title bar night]
  GB.ACCENTS = {
    tulasi: { name: 'Tulasi', day: '#1c6b58', night: '#82c5ae', hdr: '#22423a', hdrN: '#111a1d' },
    saffron: { name: 'Saffron', day: '#b8621d', night: '#e6a565', hdr: '#4a2d17', hdrN: '#1a1410' },
    yamuna: { name: 'Yamuna', day: '#1f6f80', night: '#7cc3d1', hdr: '#173a44', hdrN: '#0f181b' },
    indigo: { name: 'Indigo', day: '#43489a', night: '#a3a8e6', hdr: '#262a55', hdrN: '#12131d' },
    lotus: { name: 'Lotus', day: '#a8436a', night: '#e59ab8', hdr: '#4d2033', hdrN: '#1a1115' },
    gold: { name: 'Gold', day: '#8f6f1f', night: '#e2c47e', hdr: '#3f3519', hdrN: '#16140e' }
  };
  GB.accentInk = nightInk => { const a = GB.ACCENTS[(GB.prefs && GB.prefs.accent) || 'tulasi'] || GB.ACCENTS.tulasi; return nightInk ? (a.key === 'tulasi' ? '#e2c47e' : a.night) : a.day; };
  for (const k in GB.ACCENTS) GB.ACCENTS[k].key = k;
  GB.artwork.clear = () => cache.clear();
  // every <img> asks for the app's old names; answer with the drawings
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { d.set.call(this, GB.asset(v)); } });
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (k, v) { return setAttr.call(this, k, this.localName === 'img' && String(k).toLowerCase() === 'src' ? GB.asset(v) : v); };
})(window.GB = window.GB || {});
