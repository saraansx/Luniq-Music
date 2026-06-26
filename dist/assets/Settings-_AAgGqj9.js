import{r as d,j as e}from"./vendor-DnVYEdEQ.js";import{b as g,c as G,j as U,a as B,m as H}from"./index-S_QeDys9.js";const F=({accessToken:a,cookies:l})=>{var t,u,m,b;const{t:s}=g(),[i,h]=d.useState(null),[r,o]=d.useState(!0),c=G();d.useEffect(()=>{a&&(async()=>{try{o(!0);const[v,x]=await Promise.all([c.user.me(),c.user.attributes().catch(()=>null)]);h({profile:v,attributes:x})}catch(v){console.error("Failed to fetch user data:",v)}finally{o(!1)}})()},[c,a]);const n=async()=>{var f;try{await((f=window.ipcRenderer)==null?void 0:f.invoke("logout")),window.location.reload()}catch(v){console.error("Logout failed:",v)}};return e.jsxs("div",{className:"settings-account-card",children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:s("settings.account")}),e.jsx("p",{className:"settings-account-description",children:s("settings.accountDesc")})]}),e.jsx("div",{className:"account-content",children:r?e.jsx("div",{className:"account-loading",children:s("settings.loadingProfile")}):i?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"account-profile-section",children:[e.jsxs("div",{className:"account-profile-info",children:[i.profile.images&&i.profile.images.length>0?e.jsx("img",{src:i.profile.images[0].url||((u=(t=i.profile.images[0].sources)==null?void 0:t[0])==null?void 0:u.url)||i.profile.images[0],alt:i.profile.display_name,className:"account-avatar"}):e.jsx("div",{className:"account-avatar-placeholder",children:(b=(m=i.profile.display_name)==null?void 0:m.charAt(0))==null?void 0:b.toUpperCase()}),e.jsxs("div",{className:"account-details",children:[e.jsx("h3",{className:"account-name",children:i.profile.display_name}),e.jsx("p",{className:"account-status",children:"Lune Listener"})]})]}),e.jsx("button",{className:"account-logout-btn",onClick:n,children:s("settings.logOut")})]}),e.jsxs("div",{className:"settings-disclaimer",children:[e.jsxs("div",{className:"disclaimer-header",children:[e.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"12",r:"10"}),e.jsx("line",{x1:"12",y1:"8",x2:"12",y2:"12"}),e.jsx("line",{x1:"12",y1:"16",x2:"12.01",y2:"16"})]}),e.jsx("span",{children:s("settings.disclaimer")})]}),e.jsx("p",{children:s("settings.disclaimerText")})]})]}):e.jsxs("div",{className:"account-error",children:[e.jsx("p",{children:s("settings.couldNotLoad")}),e.jsx("button",{className:"account-logout-btn",onClick:n,children:s("settings.logOutAnyway")})]})})]})},j=({label:a,subLabel:l,options:s,value:i,onChange:h})=>{const[r,o]=d.useState(!1),c=d.useRef(null),n=s.find(t=>t.value===i);return d.useEffect(()=>{const t=u=>{c.current&&!c.current.contains(u.target)&&o(!1)};return document.addEventListener("mousedown",t),()=>document.removeEventListener("mousedown",t)},[]),e.jsxs("div",{className:"settings-row custom-dropdown-container",ref:c,style:{position:"relative",zIndex:r?"var(--z-float)":"var(--z-base)"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a}),e.jsx("span",{className:"row-sub",children:l})]}),e.jsxs("div",{className:"dropdown-wrapper",children:[e.jsxs("button",{className:`dropdown-trigger ${r?"active":""}`,onClick:()=>o(!r),children:[e.jsx("span",{children:n==null?void 0:n.label}),e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",className:`chevron ${r?"up":""}`,children:e.jsx("polyline",{points:"6 9 12 15 18 9"})})]}),r&&e.jsx("div",{className:"dropdown-menu",children:s.map(t=>e.jsxs("div",{className:`dropdown-item ${t.value===i?"selected":""}`,onClick:()=>{h(t.value),o(!1)},children:[t.label,t.value===i&&e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"20 6 9 17 4 12"})})]},t.value))})]})]})},Y=()=>{const{language:a,setLanguage:l,t:s}=g(),[i,h]=d.useState("US");d.useEffect(()=>{(async()=>{var m;const u=await((m=window.ipcRenderer)==null?void 0:m.invoke("get-setting","region"));u&&h(u)})()},[]);const r=async t=>{l(t)},o=async t=>{var u;h(t),await((u=window.ipcRenderer)==null?void 0:u.invoke("set-setting","region",t))},c=[{value:"en",label:"English"},{value:"es",label:"Español"},{value:"fr",label:"Français"},{value:"de",label:"Deutsch"},{value:"ja",label:"日本語"},{value:"pt",label:"Português"},{value:"it",label:"Italiano"},{value:"ko",label:"한국어"},{value:"zh",label:"中文"},{value:"ru",label:"Русский"},{value:"ar",label:"العربية"},{value:"hi",label:"हिन्दी"},{value:"tr",label:"Türkçe"},{value:"pl",label:"Polski"},{value:"nl",label:"Nederlands"},{value:"sv",label:"Svenska"},{value:"th",label:"ไทย"},{value:"vi",label:"Tiếng Việt"},{value:"id",label:"Bahasa Indonesia"},{value:"uk",label:"Українська"}],n=[{value:"AL",label:"Albania"},{value:"DZ",label:"Algeria"},{value:"AD",label:"Andorra"},{value:"AO",label:"Angola"},{value:"AG",label:"Antigua and Barbuda"},{value:"AR",label:"Argentina"},{value:"AM",label:"Armenia"},{value:"AU",label:"Australia"},{value:"AT",label:"Austria"},{value:"AZ",label:"Azerbaijan"},{value:"BS",label:"Bahamas"},{value:"BH",label:"Bahrain"},{value:"BD",label:"Bangladesh"},{value:"BB",label:"Barbados"},{value:"BY",label:"Belarus"},{value:"BE",label:"Belgium"},{value:"BZ",label:"Belize"},{value:"BJ",label:"Benin"},{value:"BT",label:"Bhutan"},{value:"BO",label:"Bolivia"},{value:"BA",label:"Bosnia and Herzegovina"},{value:"BW",label:"Botswana"},{value:"BR",label:"Brazil"},{value:"BN",label:"Brunei"},{value:"BG",label:"Bulgaria"},{value:"BF",label:"Burkina Faso"},{value:"BI",label:"Burundi"},{value:"CV",label:"Cabo Verde"},{value:"KH",label:"Cambodia"},{value:"CM",label:"Cameroon"},{value:"CA",label:"Canada"},{value:"TD",label:"Chad"},{value:"CL",label:"Chile"},{value:"CO",label:"Colombia"},{value:"KM",label:"Comoros"},{value:"CG",label:"Congo"},{value:"CD",label:"Congo (DRC)"},{value:"CR",label:"Costa Rica"},{value:"HR",label:"Croatia"},{value:"CW",label:"Curaçao"},{value:"CY",label:"Cyprus"},{value:"CZ",label:"Czech Republic"},{value:"DK",label:"Denmark"},{value:"DJ",label:"Djibouti"},{value:"DM",label:"Dominica"},{value:"DO",label:"Dominican Republic"},{value:"EC",label:"Ecuador"},{value:"EG",label:"Egypt"},{value:"SV",label:"El Salvador"},{value:"GQ",label:"Equatorial Guinea"},{value:"EE",label:"Estonia"},{value:"SZ",label:"Eswatini"},{value:"ET",label:"Ethiopia"},{value:"FJ",label:"Fiji"},{value:"FI",label:"Finland"},{value:"FR",label:"France"},{value:"GA",label:"Gabon"},{value:"GM",label:"Gambia"},{value:"GE",label:"Georgia"},{value:"DE",label:"Germany"},{value:"GH",label:"Ghana"},{value:"GR",label:"Greece"},{value:"GD",label:"Grenada"},{value:"GT",label:"Guatemala"},{value:"GN",label:"Guinea"},{value:"GW",label:"Guinea-Bissau"},{value:"GY",label:"Guyana"},{value:"HT",label:"Haiti"},{value:"HN",label:"Honduras"},{value:"HK",label:"Hong Kong"},{value:"HU",label:"Hungary"},{value:"IS",label:"Iceland"},{value:"IN",label:"India"},{value:"ID",label:"Indonesia"},{value:"IQ",label:"Iraq"},{value:"IE",label:"Ireland"},{value:"IL",label:"Israel"},{value:"IT",label:"Italy"},{value:"CI",label:"Ivory Coast"},{value:"JM",label:"Jamaica"},{value:"JP",label:"Japan"},{value:"JO",label:"Jordan"},{value:"KZ",label:"Kazakhstan"},{value:"KE",label:"Kenya"},{value:"KI",label:"Kiribati"},{value:"KR",label:"South Korea"},{value:"KW",label:"Kuwait"},{value:"KG",label:"Kyrgyzstan"},{value:"LA",label:"Laos"},{value:"LV",label:"Latvia"},{value:"LB",label:"Lebanon"},{value:"LS",label:"Lesotho"},{value:"LR",label:"Liberia"},{value:"LY",label:"Libya"},{value:"LI",label:"Liechtenstein"},{value:"LT",label:"Lithuania"},{value:"LU",label:"Luxembourg"},{value:"MO",label:"Macau"},{value:"MG",label:"Madagascar"},{value:"MW",label:"Malawi"},{value:"MY",label:"Malaysia"},{value:"MV",label:"Maldives"},{value:"ML",label:"Mali"},{value:"MT",label:"Malta"},{value:"MH",label:"Marshall Islands"},{value:"MR",label:"Mauritania"},{value:"MU",label:"Mauritius"},{value:"MX",label:"Mexico"},{value:"FM",label:"Micronesia"},{value:"MD",label:"Moldova"},{value:"MC",label:"Monaco"},{value:"MN",label:"Mongolia"},{value:"ME",label:"Montenegro"},{value:"MA",label:"Morocco"},{value:"MZ",label:"Mozambique"},{value:"NA",label:"Namibia"},{value:"NR",label:"Nauru"},{value:"NP",label:"Nepal"},{value:"NL",label:"Netherlands"},{value:"NZ",label:"New Zealand"},{value:"NI",label:"Nicaragua"},{value:"NE",label:"Niger"},{value:"NG",label:"Nigeria"},{value:"MK",label:"North Macedonia"},{value:"NO",label:"Norway"},{value:"OM",label:"Oman"},{value:"PK",label:"Pakistan"},{value:"PW",label:"Palau"},{value:"PS",label:"Palestine"},{value:"PA",label:"Panama"},{value:"PG",label:"Papua New Guinea"},{value:"PY",label:"Paraguay"},{value:"PE",label:"Peru"},{value:"PH",label:"Philippines"},{value:"PL",label:"Poland"},{value:"PT",label:"Portugal"},{value:"QA",label:"Qatar"},{value:"RO",label:"Romania"},{value:"RU",label:"Russia"},{value:"RW",label:"Rwanda"},{value:"WS",label:"Samoa"},{value:"SM",label:"San Marino"},{value:"ST",label:"São Tomé and Príncipe"},{value:"SA",label:"Saudi Arabia"},{value:"SN",label:"Senegal"},{value:"RS",label:"Serbia"},{value:"SC",label:"Seychelles"},{value:"SL",label:"Sierra Leone"},{value:"SG",label:"Singapore"},{value:"SK",label:"Slovakia"},{value:"SI",label:"Slovenia"},{value:"SB",label:"Solomon Islands"},{value:"ZA",label:"South Africa"},{value:"ES",label:"Spain"},{value:"LK",label:"Sri Lanka"},{value:"KN",label:"St. Kitts and Nevis"},{value:"LC",label:"St. Lucia"},{value:"VC",label:"St. Vincent & Grenadines"},{value:"SR",label:"Suriname"},{value:"SE",label:"Sweden"},{value:"CH",label:"Switzerland"},{value:"TW",label:"Taiwan"},{value:"TJ",label:"Tajikistan"},{value:"TZ",label:"Tanzania"},{value:"TH",label:"Thailand"},{value:"TL",label:"Timor-Leste"},{value:"TG",label:"Togo"},{value:"TO",label:"Tonga"},{value:"TT",label:"Trinidad and Tobago"},{value:"TN",label:"Tunisia"},{value:"TR",label:"Turkey"},{value:"TV",label:"Tuvalu"},{value:"UG",label:"Uganda"},{value:"UA",label:"Ukraine"},{value:"AE",label:"United Arab Emirates"},{value:"GB",label:"United Kingdom"},{value:"US",label:"United States"},{value:"UY",label:"Uruguay"},{value:"UZ",label:"Uzbekistan"},{value:"VU",label:"Vanuatu"},{value:"VE",label:"Venezuela"},{value:"VN",label:"Vietnam"},{value:"ZM",label:"Zambia"},{value:"ZW",label:"Zimbabwe"}];return e.jsxs("div",{className:"settings-language-card",style:{position:"relative"},children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:s("langRegion.title")}),e.jsx("p",{className:"settings-account-description",children:s("langRegion.sub")})]}),e.jsxs("div",{className:"language-content",children:[e.jsx(j,{label:s("langRegion.langLabel"),subLabel:s("langRegion.langSub"),options:c,value:a,onChange:r}),e.jsx(j,{label:s("langRegion.regLabel"),subLabel:s("langRegion.regSub"),options:n,value:i,onChange:o})]})]})},W=()=>{const{t:a}=g(),{accentColor:l,setAccentColor:s,layoutDensity:i,setLayoutDensity:h,dynamicColor:r,setDynamicColor:o}=U(),c=[{id:"slate",name:a("appearance.color.slate"),hex:"#64748b"},{id:"zinc",name:a("appearance.color.zinc"),hex:"#71717a"},{id:"stone",name:a("appearance.color.stone"),hex:"#78716c"},{id:"red",name:a("appearance.color.red"),hex:"#dc2626"},{id:"orange",name:a("appearance.color.orange"),hex:"#f97316"},{id:"yellow",name:a("appearance.color.yellow"),hex:"#eab308"},{id:"green",name:a("appearance.color.green"),hex:"#22c55e"},{id:"blue",name:a("appearance.color.blue"),hex:"#0077f9"},{id:"violet",name:a("appearance.color.violet"),hex:"#8b5cf6"},{id:"rose",name:a("appearance.color.rose"),hex:"#ec4899"}];return e.jsxs("div",{className:"settings-language-card",children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("appearance.title")}),e.jsx("p",{className:"settings-account-description",children:a("appearance.sub")})]}),e.jsxs("div",{className:"language-content",children:[e.jsxs("div",{className:"settings-row dynamic-color-row",children:[e.jsxs("div",{className:"row-info",children:[e.jsxs("div",{className:"dynamic-color-label-wrap",children:[e.jsx("span",{className:"row-label",style:{fontWeight:400},children:a("appearance.dynamicColorLabel")}),r&&e.jsxs("span",{className:"dynamic-color-live-badge",children:[e.jsx("span",{className:"dynamic-color-live-dot"}),"Live"]})]}),e.jsx("span",{className:"row-sub",children:a("appearance.dynamicColorSub")})]}),e.jsx("button",{className:`lune-toggle ${r?"on":""}`,onClick:()=>o(!r),"aria-pressed":r,title:a("appearance.dynamicColorLabel"),children:e.jsx("span",{className:"lune-toggle-thumb"})})]}),e.jsxs("div",{className:`settings-row accent-section ${r?"accent-section--dimmed":""}`,style:{flexDirection:"column",alignItems:"flex-start",gap:"16px"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",style:{fontWeight:400},children:a("appearance.accentLabel")}),e.jsx("span",{className:"row-sub",children:a(r?"appearance.accentSubDynamic":"appearance.accentSub")})]}),e.jsx("div",{className:`accent-color-grid ${r?"accent-color-grid--disabled":""}`,children:c.map(n=>e.jsxs("button",{className:`accent-color-btn ${l===n.id&&!r?"active":""}`,onClick:()=>{r||s(n.id)},style:{"--color-val":n.hex},title:n.name,disabled:r,children:[e.jsx("div",{className:"accent-color-circle",style:{backgroundColor:n.hex},children:l===n.id&&!r&&e.jsx("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"white",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"20 6 9 17 4 12"})})}),e.jsx("span",{className:"accent-color-name",children:n.name})]},n.id))})]}),e.jsxs("div",{className:"settings-row",style:{flexDirection:"column",alignItems:"flex-start",gap:"16px"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",style:{fontWeight:400},children:a("appearance.densityLabel")}),e.jsx("span",{className:"row-sub",children:a("appearance.densitySub")})]}),e.jsxs("div",{style:{display:"flex",gap:"12px",width:"100%"},children:[e.jsx("button",{className:`density-toggle-btn ${i==="comfortable"?"active":""}`,onClick:()=>h("comfortable"),children:a("appearance.comfortable")}),e.jsx("button",{className:`density-toggle-btn ${i==="compact"?"active":""}`,onClick:()=>h("compact"),children:a("appearance.compact")})]})]})]})]})},y=({label:a,subLabel:l,options:s,value:i,onChange:h,disabled:r})=>{const[o,c]=d.useState(!1),n=d.useRef(null),t=s.find(u=>u.value===i);return d.useEffect(()=>{const u=m=>{n.current&&!n.current.contains(m.target)&&c(!1)};return document.addEventListener("mousedown",u),()=>document.removeEventListener("mousedown",u)},[]),e.jsxs("div",{className:"settings-row custom-dropdown-container",ref:n,style:{position:"relative",zIndex:o?"var(--z-float)":"var(--z-base)"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a}),e.jsx("span",{className:"row-sub",children:l})]}),e.jsxs("div",{className:`dropdown-wrapper ${r?"disabled":""}`,children:[e.jsxs("button",{className:`dropdown-trigger ${o?"active":""} ${r?"disabled":""}`,onClick:()=>{r||c(!o)},disabled:r,style:r?{opacity:.5,cursor:"not-allowed"}:{},children:[e.jsx("span",{children:(t==null?void 0:t.label)||i}),e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",className:`chevron ${o?"up":""}`,children:e.jsx("polyline",{points:"6 9 12 15 18 9"})})]}),o&&!r&&e.jsx("div",{className:"dropdown-menu",children:s.map(u=>e.jsxs("div",{className:`dropdown-item ${u.value===i?"selected":""}`,onClick:()=>{h(u.value),c(!1)},children:[u.label,u.value===i&&e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"20 6 9 17 4 12"})})]},u.value))})]})]})},z=()=>{const{t:a}=g(),{audioQuality:l,setAudioQuality:s,downloadQuality:i,setDownloadQuality:h,audioEngine:r,setAudioEngine:o,autoplayEnabled:c,setAutoplayEnabled:n,normalizeVolume:t,setNormalizeVolume:u,lowDataMode:m,setLowDataMode:b,monoAudio:f,setMonoAudio:v,audioDeviceId:x,setAudioDeviceId:N,playbackSpeed:L,setPlaybackSpeed:C,eqEnabled:S,setEqEnabled:T}=B(),[A,R]=d.useState([]);d.useEffect(()=>{const p=async()=>{try{const O=(await navigator.mediaDevices.enumerateDevices()).filter(M=>M.kind==="audiooutput");R(O)}catch(k){console.error("Failed to fetch audio output devices:",k)}};return p(),navigator.mediaDevices.ondevicechange=p,()=>{navigator.mediaDevices.ondevicechange=null}},[]);const w=A.map(p=>({value:p.deviceId,label:p.label||(p.deviceId==="default"?"Default":`Device ${p.deviceId.slice(0,5)}...`)}));(w.length===0||!w.find(p=>p.value==="default"))&&w.unshift({value:"default",label:"System Default"});const E=[{value:"96",label:`96 ${a("playback.kbps")}`},{value:"128",label:`128 ${a("playback.kbps")}`},{value:"256",label:`256 ${a("playback.kbps")}`},{value:"320",label:`320 ${a("playback.kbps")}`}],I=[{value:"youtubei",label:a("playback.engineYoutubei")},{value:"ytdlp",label:a("playback.engineYtdlp")}],P=[{value:"96",label:`96 ${a("playback.kbps")}`},{value:"128",label:`128 ${a("playback.kbps")}`},{value:"256",label:`256 ${a("playback.kbps")}`},{value:"320",label:`320 ${a("playback.kbps")}`}],D=[{value:"0.5",label:"0.5x"},{value:"0.75",label:"0.75x"},{value:"1",label:"1.0x (Normal)"},{value:"1.25",label:"1.25x"},{value:"1.5",label:"1.5x"},{value:"2",label:"2.0x"}];return e.jsxs("div",{className:"settings-language-card",style:{position:"relative"},children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("playback.title")}),e.jsx("p",{className:"settings-account-description",children:a("playback.sub")})]}),e.jsxs("div",{className:"language-content",children:[e.jsx(y,{label:a("playback.audioEngine"),subLabel:a("playback.audioEngineSub"),options:I,value:r,onChange:p=>o(p)}),e.jsx(y,{label:a("playback.audioQuality"),subLabel:a("playback.audioQualitySub"),options:E,value:m?"96":l,onChange:p=>s(p),disabled:m}),e.jsx(y,{label:a("playback.downloadQuality"),subLabel:a("playback.downloadQualitySub"),options:P,value:i,onChange:p=>h(p)}),e.jsxs("div",{className:"settings-row",style:{marginTop:"4px"},children:[e.jsxs("div",{className:"row-info",style:{gap:"4px"},children:[e.jsx("span",{className:"row-label",children:a("playback.autoplay")}),e.jsx("span",{className:"row-sub",children:a("playback.autoplaySub")})]}),e.jsxs("label",{className:"lune-switch",children:[e.jsx("input",{type:"checkbox",checked:c,onChange:p=>n(p.target.checked)}),e.jsx("span",{className:"lune-switch-slider"})]})]}),e.jsxs("div",{className:"settings-row",style:{marginTop:"4px"},children:[e.jsxs("div",{className:"row-info",style:{gap:"4px"},children:[e.jsx("span",{className:"row-label",children:a("playback.normalize")}),e.jsx("span",{className:"row-sub",children:a("playback.normalizeSub")})]}),e.jsxs("label",{className:"lune-switch",children:[e.jsx("input",{type:"checkbox",checked:t,onChange:p=>u(p.target.checked)}),e.jsx("span",{className:"lune-switch-slider"})]})]}),e.jsxs("div",{className:"settings-row",style:{marginTop:"4px"},children:[e.jsxs("div",{className:"row-info",style:{gap:"4px"},children:[e.jsx("span",{className:"row-label",children:a("playback.lowData")}),e.jsx("span",{className:"row-sub",children:a("playback.lowDataSub")})]}),e.jsxs("label",{className:"lune-switch",children:[e.jsx("input",{type:"checkbox",checked:m,onChange:p=>b(p.target.checked)}),e.jsx("span",{className:"lune-switch-slider"})]})]}),e.jsxs("div",{className:"settings-row",style:{marginTop:"4px"},children:[e.jsxs("div",{className:"row-info",style:{gap:"4px"},children:[e.jsx("span",{className:"row-label",children:a("playback.mono")||"Mono Audio"}),e.jsx("span",{className:"row-sub",children:a("playback.monoSub")||"Combines the left and right audio channels into one."})]}),e.jsxs("label",{className:"lune-switch",children:[e.jsx("input",{type:"checkbox",checked:f,onChange:p=>v(p.target.checked)}),e.jsx("span",{className:"lune-switch-slider"})]})]}),e.jsxs("div",{className:"settings-row",style:{marginTop:"4px"},children:[e.jsxs("div",{className:"row-info",style:{gap:"4px"},children:[e.jsx("span",{className:"row-label",children:a("playback.equalizer")||"Equalizer"}),e.jsx("span",{className:"row-sub",children:a("playback.equalizerSub")||"Fine-tune your audio with custom frequency bands."})]}),e.jsxs("label",{className:"lune-switch",children:[e.jsx("input",{type:"checkbox",checked:S,onChange:p=>T(p.target.checked)}),e.jsx("span",{className:"lune-switch-slider"})]})]}),e.jsx(y,{label:a("playback.outputDevice")||"Output Device",subLabel:a("playback.outputDeviceSub")||"Choose which speakers or headphones to play music from.",options:w,value:x,onChange:p=>N(p)}),e.jsx(y,{label:a("playback.speed")||"Playback Speed",subLabel:a("playback.speedSub")||"Adjust how fast the music plays.",options:D,value:String(L),onChange:p=>C(parseFloat(p))})]})]})},V=()=>{const{t:a}=g(),[l,s]=d.useState(""),[i,h]=d.useState(!0);d.useEffect(()=>{(async()=>{var c,n;try{const t=await((c=window.ipcRenderer)==null?void 0:c.invoke("get-setting","downloadLocation"));if(t)s(t);else{const u=await((n=window.ipcRenderer)==null?void 0:n.invoke("get-default-download-location"));s(u||"")}}catch(t){console.warn("Failed to load download settings",t)}finally{h(!1)}})()},[]);const r=async()=>{var o,c;try{const n=await((o=window.ipcRenderer)==null?void 0:o.invoke("select-directory"));n&&(s(n),await((c=window.ipcRenderer)==null?void 0:c.invoke("set-setting","downloadLocation",n)))}catch(n){console.error("Failed to select directory",n)}};return i?null:e.jsxs("div",{className:"settings-language-card",style:{position:"relative"},children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("downloads.title")||"Downloads"}),e.jsx("p",{className:"settings-account-description",children:a("downloads.sub")||"Manage your local music storage and download paths."})]}),e.jsx("div",{className:"language-content",children:e.jsxs("div",{className:"settings-row",children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("downloads.location")||"Download location"}),e.jsx("span",{className:"row-sub",children:l||"Not set"})]}),e.jsx("button",{className:"dropdown-trigger",onClick:r,title:"Change folder",style:{width:"auto",minWidth:"60px",justifyContent:"center"},children:e.jsx("svg",{width:"20",height:"20",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"})})})]})})]})},q=()=>{const{t:a}=g(),[l,s]=d.useState(!1),[i,h]=d.useState(!1);return e.jsxs("div",{className:"cache-card settings-language-card",style:{position:"relative"},children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("cache.title")}),e.jsx("p",{className:"settings-account-description",children:a("cache.sub")})]}),e.jsxs("div",{className:"language-content",children:[e.jsxs("div",{className:"settings-row",children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("cache.clear")}),e.jsx("span",{className:"row-sub",children:a("cache.clearSub")})]}),e.jsx("button",{className:`dropdown-trigger ${i?"success":"danger"}`,disabled:l||i,onClick:async()=>{s(!0);const r=await window.ipcRenderer.invoke("clear-cache");s(!1),r.success&&(h(!0),setTimeout(()=>h(!1),2e3))},style:{width:"auto",minWidth:"140px",justifyContent:"center"},children:e.jsx("span",{children:l?"...":i?"✓":a("cache.clear")})})]}),e.jsxs("div",{className:"settings-row",children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("cache.open")}),e.jsx("span",{className:"row-sub",children:a("cache.openSub")})]}),e.jsx("button",{className:"dropdown-trigger",onClick:()=>window.ipcRenderer.invoke("open-cache-folder"),style:{width:"auto",minWidth:"140px",justifyContent:"center"},children:e.jsx("span",{children:a("cache.open")})})]})]})]})},$=({label:a,subLabel:l,options:s,value:i,onChange:h})=>{const[r,o]=d.useState(!1),c=d.useRef(null),n=s.find(t=>t.value===i);return d.useEffect(()=>{const t=u=>{c.current&&!c.current.contains(u.target)&&o(!1)};return document.addEventListener("mousedown",t),()=>document.removeEventListener("mousedown",t)},[]),e.jsxs("div",{className:"settings-row custom-dropdown-container",ref:c,style:{position:"relative",zIndex:r?"var(--z-float)":"var(--z-base)"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a}),e.jsx("span",{className:"row-sub",children:l})]}),e.jsxs("div",{className:"dropdown-wrapper",children:[e.jsxs("button",{className:`dropdown-trigger ${r?"active":""}`,onClick:()=>o(!r),children:[e.jsx("span",{children:n==null?void 0:n.label}),e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",className:`chevron ${r?"up":""}`,children:e.jsx("polyline",{points:"6 9 12 15 18 9"})})]}),r&&e.jsx("div",{className:"dropdown-menu",children:s.map(t=>e.jsxs("div",{className:`dropdown-item ${t.value===i?"selected":""}`,onClick:()=>{h(t.value),o(!1)},children:[t.label,t.value===i&&e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"3",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"20 6 9 17 4 12"})})]},t.value))})]})]})},K=()=>{const{t:a}=g(),[l,s]=d.useState("minimize"),[i,h]=d.useState(!0);d.useEffect(()=>{(async()=>{var t,u;try{const m=await((t=window.ipcRenderer)==null?void 0:t.invoke("get-setting","closeBehavior"));m&&s(m);const b=await((u=window.ipcRenderer)==null?void 0:u.invoke("get-setting","discordRPC"));b!==void 0&&h(b)}catch(m){console.warn("Failed to load settings",m)}})()},[]);const r=async n=>{var t;s(n);try{await((t=window.ipcRenderer)==null?void 0:t.invoke("set-setting","closeBehavior",n))}catch(u){console.warn("Failed to save closeBehavior setting",u)}},o=async n=>{var t;h(n);try{await((t=window.ipcRenderer)==null?void 0:t.invoke("set-setting","discordRPC",n))}catch(u){console.warn("Failed to save discordRPC setting",u)}},c=[{value:"close",label:a("desktop.closeApp")||"Close App"},{value:"minimize",label:a("desktop.minimizeToTray")||"Minimize to Tray"}];return e.jsxs("div",{className:"settings-language-card desktop-card",style:{position:"relative"},children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("desktop.title")||"Desktop"}),e.jsx("p",{className:"settings-account-description",children:a("desktop.sub")||"Manage desktop integration and window behavior."})]}),e.jsxs("div",{className:"language-content",children:[e.jsx($,{label:a("desktop.closeBehavior")||"Close Behavior",subLabel:a("desktop.closeBehaviorSub")||"Choose what happens when you click the close button.",options:c,value:l,onChange:r}),e.jsxs("div",{className:"settings-row",style:{marginTop:"4px"},children:[e.jsxs("div",{className:"row-info",style:{gap:"4px"},children:[e.jsx("span",{className:"row-label",children:a("desktop.discordRPC")||"Discord Rich Presence"}),e.jsx("span",{className:"row-sub",children:a("desktop.discordRPCSub")||"Show the currently playing song on your Discord profile."})]}),e.jsxs("label",{className:"lune-switch",children:[e.jsx("input",{type:"checkbox",checked:i,onChange:n=>o(n.target.checked)}),e.jsx("span",{className:"lune-switch-slider"})]})]})]})]})},Q=({onClose:a})=>{const[l,s]=d.useState([]),[i,h]=d.useState(!1),r=d.useRef(null),o=d.useRef(0),c=async()=>{try{const n=await window.ipcRenderer.invoke("get-logs");s(n)}catch(n){console.error("Failed to fetch logs",n)}};return d.useEffect(()=>{c();const n=(t,u)=>{s(m=>{const b=[...m,u];return b.length>1e3&&b.shift(),b})};return window.ipcRenderer.on("new-log-entry",n),()=>{window.ipcRenderer.off("new-log-entry",n)}},[]),d.useEffect(()=>{if(r.current){const{scrollTop:n,scrollHeight:t,clientHeight:u}=r.current;(o.current===0||o.current-n-u<50)&&(r.current.scrollTop=t),o.current=t}},[l]),e.jsx("div",{className:"logs-modal-overlay",children:e.jsxs("div",{className:`logs-modal-window ${i?"maximized":""}`,children:[e.jsxs("div",{className:"logs-modal-header",children:[e.jsxs("div",{className:"logs-header-left",children:[e.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"}),e.jsx("polyline",{points:"13 2 13 9 20 9"})]}),e.jsx("span",{children:"System Logs"})]}),e.jsxs("div",{className:"logs-header-actions",children:[e.jsx("button",{onClick:()=>h(!i),title:"Maximize",children:i?e.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",children:e.jsx("path",{d:"M4 14h10v10M20 10H10V0"})}):e.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",children:[e.jsx("polyline",{points:"15 3 21 3 21 9"}),e.jsx("polyline",{points:"9 21 3 21 3 15"}),e.jsx("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),e.jsx("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),e.jsx("button",{onClick:a,title:"Close",className:"close-btn",children:e.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",children:[e.jsx("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e.jsx("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),e.jsx("div",{className:"logs-content",ref:r,children:l.length===0?e.jsx("div",{className:"no-logs",children:"No logs captured yet."}):l.map((n,t)=>e.jsxs("div",{className:`log-entry ${n.type}`,children:[e.jsx("span",{className:"log-time",children:new Date(n.timestamp).toLocaleTimeString()}),e.jsx("span",{className:"log-msg",children:n.message})]},t))}),e.jsxs("div",{className:"logs-footer",children:[e.jsxs("span",{children:["Total Logs: ",l.length]}),e.jsxs("div",{className:"logs-footer-buttons",children:[e.jsx("button",{onClick:()=>{const n=l.map(u=>`[${new Date(u.timestamp).toLocaleTimeString()}] [${u.type.toUpperCase()}] ${u.message}`).join(`
`);navigator.clipboard.writeText(n);const t=document.getElementById("copy-logs-btn");t&&(t.innerText="Copied!",setTimeout(()=>t.innerText="Copy All",2e3))},id:"copy-logs-btn",children:"Copy All"}),e.jsx("button",{onClick:async()=>{await window.ipcRenderer.invoke("clear-logs"),s([])},children:"Clear"})]})]})]})})},Z=()=>{const{t:a}=g(),[l,s]=d.useState(!1);return e.jsxs("div",{className:"settings-language-card developer-card",children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("developer.title")||"Developers"}),e.jsx("p",{className:"settings-account-description",children:a("developer.sub")||"Advanced tools and application logging for debugging."})]}),e.jsx("div",{className:"language-content",children:e.jsxs("div",{className:"settings-row",children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("developer.logsLabel")||"Application Logs"}),e.jsx("span",{className:"row-sub",children:a("developer.logsSub")||"View real-time system logs and debug information."})]}),e.jsx("button",{className:"lune-btn-secondary",onClick:()=>s(!0),style:{padding:"8px 16px",background:"rgba(255, 255, 255, 0.05)",borderRadius:"8px",fontSize:"13px",fontWeight:600,color:"white",border:"1px solid rgba(255, 255, 255, 0.1)"},children:a("developer.openLogs")||"Open Logs"})]})}),l&&e.jsx(Q,{onClose:()=>s(!1)})]})},J=()=>{const{t:a}=g(),[l,s]=d.useState(!0),[i,h]=d.useState(!0);d.useEffect(()=>{(async()=>{if(window.ipcRenderer){const n=await window.ipcRenderer.invoke("get-setting","autoUpdateApp"),t=await window.ipcRenderer.invoke("get-setting","autoUpdateYtdlp");n!==void 0&&s(n),t!==void 0&&h(t)}})()},[]);const r=c=>{s(c),window.ipcRenderer&&window.ipcRenderer.invoke("set-setting","autoUpdateApp",c)},o=c=>{h(c),window.ipcRenderer&&window.ipcRenderer.invoke("set-setting","autoUpdateYtdlp",c)};return e.jsxs("div",{className:"settings-language-card about-card",children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("updates.title")||"Updates"}),e.jsx("p",{className:"settings-account-description",children:a("updates.sub")||"Manage application updates and playback system optimizations."})]}),e.jsxs("div",{className:"language-content",children:[e.jsxs("div",{className:"settings-row",onClick:()=>r(!l),style:{cursor:"pointer"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("updates.autoUpdateLabel")||"Auto-Update Lune"}),e.jsx("span",{className:"row-sub",children:a("updates.autoUpdateSub")||"Automatically download and install updates in the background."})]}),e.jsxs("label",{className:"about-switch",onClick:c=>c.stopPropagation(),children:[e.jsx("input",{type:"checkbox",checked:l,onChange:c=>r(c.target.checked)}),e.jsx("span",{className:"about-switch-slider"})]})]}),e.jsx("div",{className:`settings-row ${l?"disabled":""}`,onClick:()=>{l||window.ipcRenderer.invoke("check-app-update")},style:{cursor:l?"default":"pointer",marginTop:"12px",borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:"12px",opacity:l?.4:1},children:e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",style:{color:l?"var(--text-dim)":"var(--accent)",fontWeight:500},children:a("updates.checkUpdate")||"Check for Updates"}),e.jsx("span",{className:"row-sub",children:l?a("updates.managedByAuto")||"Updates are managed automatically.":a("updates.checkUpdateSub")||"Manually check if a new version is available."})]})}),e.jsxs("div",{className:"settings-row",onClick:()=>o(!i),style:{cursor:"pointer",marginTop:"24px",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"24px"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("updates.ytdlpLabel")||"Update Playback Drivers"}),e.jsx("span",{className:"row-sub",children:a("updates.ytdlpSub")||"Automatically keep the playback system optimized."})]}),e.jsxs("label",{className:"about-switch",onClick:c=>c.stopPropagation(),children:[e.jsx("input",{type:"checkbox",checked:i,onChange:c=>o(c.target.checked)}),e.jsx("span",{className:"about-switch-slider"})]})]}),e.jsx("div",{className:`settings-row ${i?"disabled":""}`,onClick:()=>{i||window.ipcRenderer.send("check-ytdlp-update")},style:{cursor:i?"default":"pointer",marginTop:"12px",borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:"12px",opacity:i?.4:1},children:e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",style:{color:i?"var(--text-dim)":"var(--accent)",fontWeight:500},children:a("updates.checkYtdlp")||"Check for Driver Updates"}),e.jsx("span",{className:"row-sub",children:i?a("updates.managedByAuto")||"Updates are managed automatically.":a("updates.checkYtdlpSub")||"Ensure your playback engine is running the latest version."})]})})]})]})},_=""+new URL("Saraans-C1S-5oj6.jpg",import.meta.url).href,X=`                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
them if you wish), that you receive source code or can get it if you
want it, that you can change the software or use pieces of it in new
free programs, and that you know you can do these things.

  To protect your rights, we need to prevent others from denying you
these rights or asking you to surrender the rights.  Therefore, you have
certain responsibilities if you distribute copies of the software, or if
you modify it: responsibilities to respect the freedom of others.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must pass on to the recipients the same
freedoms that you received.  You must make sure that they, too, receive
or can get the source code.  And you must show them these terms so they
know their rights.

  Developers that use the GNU GPL protect your rights with two steps:
(1) assert copyright on the software, and (2) offer you this License
giving you legal permission to copy, distribute and/or modify it.

  For the developers' and authors' protection, the GPL clearly explains
that there is no warranty for this free software.  For both users' and
authors' sake, the GPL requires that modified versions be marked as
changed, so that their problems will not be attributed erroneously to
authors of previous versions.

  Some devices are designed to deny users access to install or run
modified versions of the software inside them, although the manufacturer
can do so.  This is fundamentally incompatible with the aim of
protecting users' freedom to change the software.  The systematic
pattern of such abuse occurs in the area of products for individuals to
use, which is precisely where it is most unacceptable.  Therefore, we
have designed this version of the GPL to prohibit the practice for those
products.  If such problems arise substantially in other domains, we
stand ready to extend this provision to those domains in future versions
of the GPL, as needed to protect the freedom of users.

  Finally, every program is threatened constantly by software patents.
States should not allow patents to restrict development and use of
software on general-purpose computers, but in those that do, we wish to
avoid the special danger that patents applied to a free program could
make it effectively proprietary.  To prevent this, the GPL assures that
patents cannot be used to render the program non-free.

  The precise terms and conditions for copying, distribution and
modification follow.

                       TERMS AND CONDITIONS

  0. Definitions.

  "This License" refers to version 3 of the GNU General Public License.

  "Copyright" also means copyright-like laws that apply to other kinds of
works, such as semiconductor masks.

  "The Program" refers to any copyrightable work licensed under this
License.  Each licensee is addressed as "you".  "Licensees" and
"recipients" may be individuals or organizations.

  To "modify" a work means to copy from or adapt all or part of the work
in a fashion requiring copyright permission, other than the making of an
exact copy.  The resulting work is called a "modified version" of the
earlier work or a work "based on" the earlier work.

  A "covered work" means either the unmodified Program or a work based
on the Program.

  To "propagate" a work means to do anything with it that, without
permission, would make you directly or secondarily liable for
infringement under applicable copyright law, except executing it on a
computer or modifying a private copy.  Propagation includes copying,
distribution (with or without modification), making available to the
public, and in some countries other activities as well.

  To "convey" a work means any kind of propagation that enables other
parties to make or receive copies.  Mere interaction with a user through
a computer network, with no transfer of a copy, is not conveying.

  An interactive user interface displays "Appropriate Legal Notices"
to the extent that it includes a convenient and prominently visible
feature that (1) displays an appropriate copyright notice, and (2)
tells the user that there is no warranty for the work (except to the
extent that warranties are provided), that licensees may convey the
work under this License, and how to view a copy of this License.  If
the interface presents a list of user commands or options, such as a
menu, a prominent item in the list meets this criterion.

  1. Source Code.

  The "source code" for a work means the preferred form of the work
for making modifications to it.  "Object code" means any non-source
form of a work.

  A "Standard Interface" means an interface that either is an official
standard defined by a recognized standards body, or, in the case of
interfaces specified for a particular programming language, one that
is widely used among developers working in that language.

  The "System Libraries" of an executable work include anything, other
than the work as a whole, that (a) is included in the normal form of
packaging a Major Component, but which is not part of that Major
Component, and (b) serves only to enable use of the work with that
Major Component, or to implement a Standard Interface for which an
implementation is available to the public in source code form.  A
"Major Component", in this context, means a major essential component
(kernel, window system, and so on) of the specific operating system
(if any) on which the executable work runs, or a compiler used to
produce the work, or an object code interpreter used to run it.

  The "Corresponding Source" for a work in object code form means all
the source code needed to generate, install, and (for an executable
work) run the object code and to modify the work, including scripts to
control those activities.  However, it does not include the work's
System Libraries, or general-purpose tools or generally available free
programs which are used unmodified in performing those activities but
which are not part of the work.  For example, Corresponding Source
includes interface definition files associated with source files for
the work, and the source code for shared libraries and dynamically
linked subprograms that the work is specifically designed to require,
such as by intimate data communication or control flow between those
subprograms and other parts of the work.

  The Corresponding Source need not include anything that users
can regenerate automatically from other parts of the Corresponding
Source.

  The Corresponding Source for a work in source code form is that
same work.

  2. Basic Permissions.

  All rights granted under this License are granted for the term of
copyright on the Program, and are irrevocable provided the stated
conditions are met.  This License explicitly affirms your unlimited
permission to run the unmodified Program.  The output from running a
covered work is covered by this License only if the output, given its
content, constitutes a covered work.  This License acknowledges your
rights of fair use or other equivalent, as provided by copyright law.

  You may make, run and propagate covered works that you do not
convey, without conditions so long as your license otherwise remains
in force.  You may convey covered works to others for the sole purpose
of having them make modifications exclusively for you, or provide you
with facilities for running those works, provided that you comply with
the terms of this License in conveying all material for which you do
not control copyright.  Those thus making or running the covered works
for you must do so exclusively on your behalf, under your direction
and control, on terms that prohibit them from making any copies of
your copyrighted material outside their relationship with you.

  Conveying under any other circumstances is permitted solely under
the conditions stated below.  Sublicensing is not allowed; section 10
makes it unnecessary.

  3. Protecting Users' Legal Rights From Anti-Circumvention Law.

  No covered work shall be deemed part of an effective technological
measure under any applicable law fulfilling obligations under article
11 of the WIPO copyright treaty adopted on 20 December 1996, or
similar laws prohibiting or restricting circumvention of such
measures.

  When you convey a covered work, you waive any legal power to forbid
circumvention of technological measures to the extent such circumvention
is effected by exercising rights under this License with respect to
the covered work, and you disclaim any intention to limit operation or
modification of the work as a means of enforcing, against the work's
users, your or third parties' legal rights to forbid circumvention of
technological measures.

  4. Conveying Verbatim Copies.

  You may convey verbatim copies of the Program's source code as you
receive it, in any medium, provided that you conspicuously and
appropriately publish on each copy an appropriate copyright notice;
keep intact all notices stating that this License and any
non-permissive terms added in accord with section 7 apply to the code;
keep intact all notices of the absence of any warranty; and give all
recipients a copy of this License along with the Program.

  You may charge any price or no price for each copy that you convey,
and you may offer support or warranty protection for a fee.

  5. Conveying Modified Source Versions.

  You may convey a work based on the Program, or the modifications to
produce it from the Program, in the form of source code under the
terms of section 4, provided that you also meet all of these conditions:

    a) The work must carry prominent notices stating that you modified
    it, and giving a relevant date.

    b) The work must carry prominent notices stating that it is
    released under this License and any conditions added under section
    7.  This requirement modifies the requirement in section 4 to
    "keep intact all notices".

    c) You must license the entire work, as a whole, under this
    License to anyone who comes into possession of a copy.  This
    License will therefore apply, along with any applicable section 7
    additional terms, to the whole of the work, and all its parts,
    regardless of how they are packaged.  This License gives no
    permission to license the work in any other way, but it does not
    invalidate such permission if you have separately received it.

    d) If the work has interactive user interfaces, each must display
    Appropriate Legal Notices; however, if the Program has interactive
    interfaces that do not display Appropriate Legal Notices, your
    work need not make them do so.

  A compilation of a covered work with other separate and independent
works, which are not by their nature extensions of the covered work,
and which are not combined with it such as to form a larger program,
in or on a volume of a storage or distribution medium, is called an
"aggregate" if the compilation and its resulting copyright are not
used to limit the access or legal rights of the compilation's users
beyond what the individual works permit.  Inclusion of a covered work
in an aggregate does not cause this License to apply to the other
parts of the aggregate.

  6. Conveying Non-Source Forms.

  You may convey a covered work in object code form under the terms
of sections 4 and 5, provided that you also convey the
machine-readable Corresponding Source under the terms of this License,
in one of these ways:

    a) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by the
    Corresponding Source fixed on a durable physical medium
    customarily used for software interchange.

    b) Convey the object code in, or embodied in, a physical product
    (including a physical distribution medium), accompanied by a
    written offer, valid for at least three years and valid for as
    long as you offer spare parts or customer support for that product
    model, to give anyone who possesses the object code either (1) a
    copy of the Corresponding Source for all the software in the
    product that is covered by this License, on a durable physical
    medium customarily used for software interchange, for a price no
    more than your reasonable cost of physically performing this
    conveying of source, or (2) access to copy the
    Corresponding Source from a network server at no charge.

    c) Convey individual copies of the object code with a copy of the
    written offer to provide the Corresponding Source.  This
    alternative is allowed only occasionally and noncommercially, and
    only if you received the object code with such an offer, in accord
    with subsection 6b.

    d) Convey the object code by offering access from a designated
    place (gratis or for a charge), and offer equivalent access to the
    Corresponding Source in the same way through the same place at no
    further charge.  You need not require recipients to copy the
    Corresponding Source along with the object code.  If the place to
    copy the object code is a network server, the Corresponding Source
    may be on a different server (operated by you or a third party)
    that supports equivalent copying facilities, provided you maintain
    clear directions next to the object code saying where to find the
    Corresponding Source.  Regardless of what server hosts the
    Corresponding Source, you remain obligated to ensure that it is
    available for as long as needed to satisfy these requirements.

    e) Convey the object code using peer-to-peer transmission, provided
    you inform other peers where the object code and Corresponding
    Source of the work are being offered to the general public at no
    charge under subsection 6d.

  A separable portion of the object code, whose source code is excluded
from the Corresponding Source as a System Library, need not be
included in conveying the object code work.

  A "User Product" is either (1) a "consumer product", which means any
tangible personal property which is normally used for personal, family,
or household purposes, or (2) anything designed or sold for incorporation
into a dwelling.  In determining whether a product is a consumer product,
doubtful cases shall be resolved in favor of coverage.  For a particular
product received by a particular user, "normally used" refers to a
typical or common use of that class of product, regardless of the status
of the particular user or of the way in which the particular user
actually uses, or expects or is expected to use, the product.  A product
is a consumer product regardless of whether the product has substantial
commercial, industrial or non-consumer uses, unless such uses represent
the only significant mode of use of the product.

  "Installation Information" for a User Product means any methods,
procedures, authorization keys, or other information required to install
and execute modified versions of a covered work in that User Product from
a modified version of its Corresponding Source.  The information must
suffice to ensure that the continued functioning of the modified object
code is in no case prevented or interfered with solely because
modification has been made.

  If you convey an object code work under this section in, or with, or
specifically for use in, a User Product, and the conveying occurs as
part of a transaction in which the right of possession and use of the
User Product is transferred to the recipient in perpetuity or for a
fixed term (regardless of how the transaction is characterized), the
Corresponding Source conveyed under this section must be accompanied
by the Installation Information.  But this requirement does not apply
if neither you nor any third party retains the ability to install
modified object code on the User Product (for example, the work has
been installed in ROM).

  The requirement to provide Installation Information does not include a
requirement to continue to provide support service, warranty, or updates
for a work that has been modified or installed by the recipient, or for
the User Product in which it has been modified or installed.  Access to a
network may be denied when the modification itself materially and
adversely affects the operation of the network or violates the rules and
protocols for communication across the network.

  Corresponding Source conveyed, and Installation Information provided,
in accord with this section must be in a format that is publicly
documented (and with an implementation available to the public in
source code form), and must require no special password or key for
unpacking, reading or copying.

  7. Additional Terms.

  "Additional permissions" are terms that supplement the terms of this
License by making exceptions from one or more of its conditions.
Additional permissions that are applicable to the entire Program shall
be treated as though they were included in this License, to the extent
that they are valid under applicable law.  If additional permissions
apply only to part of the Program, that part may be used separately
under those permissions, but the entire Program remains governed by
this License without regard to the additional permissions.

  When you convey a copy of a covered work, you may at your option
remove any additional permissions from that copy, or from any part of
it.  (Additional permissions may be written to require their own
removal in certain cases when you modify the work.)  You may place
additional permissions on material, added by you to a covered work,
for which you have or can give appropriate copyright permission.

  Notwithstanding any other provision of this License, for material you
add to a covered work, you may (if authorized by the copyright holders of
that material) supplement the terms of this License with terms:

    a) Disclaiming warranty or limiting liability differently from the
    terms of sections 15 and 16 of this License; or

    b) Requiring preservation of specified reasonable legal notices or
    author attributions in that material or in the Appropriate Legal
    Notices displayed by works containing it; or

    c) Prohibiting misrepresentation of the origin of that material, or
    requiring that modified versions of such material be marked in
    reasonable ways as different from the original version; or

    d) Limiting the use for publicity purposes of names of licensors or
    authors of the material; or

    e) Declining to grant rights under trademark law for use of some
    trade names, trademarks, or service marks; or

    f) Requiring indemnification of licensors and authors of that
    material by anyone who conveys the material (or modified versions of
    it) with contractual assumptions of liability to the recipient, for
    any liability that these contractual assumptions directly impose on
    those licensors and authors.

  All other non-permissive additional terms are considered "further
restrictions" within the meaning of section 10.  If the Program as you
received it, or any part of it, contains a notice stating that it is
governed by this License along with a term that is a further
restriction, you may remove that term.  If a license document contains
a further restriction but permits relicensing or conveying under this
License, you may add to a covered work material governed by the terms
of that license document, provided that the further restriction does
not survive such relicensing or conveying.

  If you add terms to a covered work in accord with this section, you
must place, in the relevant source files, a statement of the
additional terms that apply to those files, or a notice indicating
where to find the applicable terms.

  Additional terms, permissive or non-permissive, may be stated in the
form of a separately written license, or stated as exceptions;
the above requirements apply either way.

  8. Termination.

  You may not propagate or modify a covered work except as expressly
provided under this License.  Any attempt otherwise to propagate or
modify it is void, and will automatically terminate your rights under
this License (including any patent licenses granted under the third
paragraph of section 11).

  However, if you cease all violation of this License, then your
license from a particular copyright holder is reinstated (a)
provisionally, unless and until the copyright holder explicitly and
finally terminates your license, and (b) permanently, if the copyright
holder fails to notify you of the violation by some reasonable means
prior to 60 days after the cessation.

  Moreover, your license from a particular copyright holder is
reinstated permanently if the copyright holder notifies you of the
violation by some reasonable means, this is the first time you have
received notice of violation of this License (for any work) from that
copyright holder, and you cure the violation prior to 30 days after
your receipt of the notice.

  Termination of your rights under this section does not terminate the
licenses of parties who have received copies or rights from you under
this License.  If your rights have been terminated and not permanently
reinstated, you do not qualify to receive new licenses for the same
material under section 10.

  9. Acceptance Not Required for Having Copies.

  You are not required to accept this License in order to receive or
run a copy of the Program.  Ancillary propagation of a covered work
occurring solely as a consequence of using peer-to-peer transmission
to receive a copy likewise does not require acceptance.  However,
nothing other than this License grants you permission to propagate or
modify any covered work.  These actions infringe copyright if you do
not accept this License.  Therefore, by modifying or propagating a
covered work, you indicate your acceptance of this License to do so.

  10. Automatic Licensing of Downstream Recipients.

  Each time you convey a covered work, the recipient automatically
receives a license from the original licensors, to run, modify and
propagate that work, subject to this License.  You are not responsible
for enforcing compliance by third parties with this License.

  An "entity transaction" is a transaction transferring control of an
organization, or substantially all assets of one, or subdividing an
organization, or merging organizations.  If propagation of a covered
work results from an entity transaction, each party to that
transaction who receives a copy of the work also receives whatever
licenses to the work the party's predecessor in interest had or could
give under the previous paragraph, plus a right to possession of the
Corresponding Source of the work from the predecessor in interest, if
the predecessor has it or can get it with reasonable efforts.

  You may not impose any further restrictions on the exercise of the
rights granted or affirmed under this License.  For example, you may
not impose a license fee, royalty, or other charge for exercise of
rights granted under this License, and you may not initiate litigation
(including a cross-claim or counterclaim in a lawsuit) alleging that
any patent claim is infringed by making, using, selling, offering for
sale, or importing the Program or any portion of it.

  11. Patents.

  A "contributor" is a copyright holder who authorizes use under this
License of the Program or a work on which the Program is based.  The
work thus licensed is called the contributor's "contributor version".

  A contributor's "essential patent claims" are all patent claims
owned or controlled by the contributor, whether already acquired or
hereafter acquired, that would be infringed by some manner, permitted
by this License, of making, using, or selling its contributor version,
but do not include claims that would be infringed only as a
consequence of further modification of the contributor version.  For
purposes of this definition, "control" includes the right to grant
patent sublicenses in a manner consistent with the requirements of
this License.

  Each contributor grants you a non-exclusive, worldwide, royalty-free
patent license under the contributor's essential patent claims, to
make, use, sell, offer for sale, import and otherwise run, modify and
propagate the contents of its contributor version.

  In the following three paragraphs, a "patent license" is any express
agreement or commitment, however denominated, not to enforce a patent
(such as an express permission to practice a patent or covenant not to
sue for patent infringement).  To "grant" such a patent license to a
party means to make such an agreement or commitment not to enforce a
patent against the party.

  If you convey a covered work, knowingly relying on a patent license,
and the Corresponding Source of the work is not available for anyone
to copy, free of charge and under the terms of this License, through a
publicly available network server or other readily accessible means,
then you must either (1) cause the Corresponding Source to be so
available, or (2) arrange to deprive yourself of the benefit of the
patent license for this particular work, or (3) arrange, in a manner
consistent with the requirements of this License, to extend the patent
license to downstream recipients.  "Knowingly relying" means you have
actual knowledge that, but for the patent license, your conveying the
covered work in a country, or your recipient's use of the covered work
in a country, would infringe one or more identifiable patents in that
country that you have reason to believe are valid.

  If, pursuant to or in connection with a single transaction or
arrangement, you convey, or propagate by procuring conveyance of, a
covered work, and grant a patent license to some of the parties
receiving the covered work authorizing them to use, propagate, modify
or convey a specific copy of the covered work, then the patent license
you grant is automatically extended to all recipients of the covered
work and works based on it.

  A patent license is "discriminatory" if it does not include within
the scope of its coverage, prohibits the exercise of, or is
conditioned on the non-exercise of one or more of the rights that are
specifically granted under this License.  You may not convey a covered
work if you are a party to an arrangement with a third party that is
in the business of distributing software, under which you make payment
to the third party based on the extent of your activity of conveying
the work, and under which the third party grants, to any of the
parties who would receive the covered work from you, a discriminatory
patent license (a) in connection with copies of the covered work
conveyed by you (or copies made from those copies), or (b) primarily
for and in connection with specific products or compilations that
contain the covered work, unless you entered into that arrangement,
or that patent license was granted, prior to 28 March 2007.

  Nothing in this License shall be construed as excluding or limiting
any implied license or other defenses to infringement that may
otherwise be available to you under applicable patent law.

  12. No Surrender of Others' Freedom.

  If conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot convey a
covered work so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you may
not convey it at all.  For example, if you agree to terms that obligate you
to collect a royalty for further conveying from those to whom you convey
the Program, the only way you could satisfy both those terms and this
License would be to refrain entirely from conveying the Program.

  13. Use with the GNU Affero General Public License.

  Notwithstanding any other provision of this License, you have
permission to link or combine any covered work with a work licensed
under version 3 of the GNU Affero General Public License into a single
combined work, and to convey the resulting work.  The terms of this
License will continue to apply to the part which is the covered work,
but the special requirements of the GNU Affero General Public License,
section 13, concerning interaction through a network will apply to the
combination as such.

  14. Revised Versions of this License.

  The Free Software Foundation may publish revised and/or new versions of
the GNU General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

  Each version is given a distinguishing version number.  If the
Program specifies that a certain numbered version of the GNU General
Public License "or any later version" applies to it, you have the
option of following the terms and conditions either of that numbered
version or of any later version published by the Free Software
Foundation.  If the Program does not specify a version number of the
GNU General Public License, you may choose any version ever published
by the Free Software Foundation.

  If the Program specifies that a proxy can decide which future
versions of the GNU General Public License can be used, that proxy's
public statement of acceptance of a version permanently authorizes you
to choose that version for the Program.

  Later license versions may give you additional or different
permissions.  However, no additional obligations are imposed on any
author or copyright holder as a result of your choosing to follow a
later version.

  15. Disclaimer of Warranty.

  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY
APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT
HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY
OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM
IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF
ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

  16. Limitation of Liability.

  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS
THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY
GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE
USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF
DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD
PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),
EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF
SUCH DAMAGES.

  17. Interpretation of Sections 15 and 16.

  If the disclaimer of warranty and limitation of liability provided
above cannot be given local legal effect according to their terms,
reviewing courts shall apply local law that most closely approximates
an absolute waiver of all civil liability in connection with the
Program, unless a warranty or assumption of liability accompanies a
copy of the Program in return for a fee.

                     END OF TERMS AND CONDITIONS

            How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
state the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

Also add information on how to contact you by electronic and paper mail.

  If the program does terminal interaction, make it output a short
notice like this when it starts in an interactive mode:

    <program>  Copyright (C) <year>  <name of author>
    This program comes with ABSOLUTELY NO WARRANTY; for details type \`show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type \`show c' for details.

The hypothetical commands \`show w' and \`show c' should show the appropriate
parts of the General Public License.  Of course, your program's commands
might be different; for a GUI interface, you would use an "about box".

  You should also get your employer (if you work as a programmer) or school,
if any, to sign a "copyright disclaimer" for the program, if necessary.
For more information on this, and how to apply and follow the GNU GPL, see
<https://www.gnu.org/licenses/>.

  The GNU General Public License does not permit incorporating your program
into proprietary programs.  If your program is a subroutine library, you
may consider it more useful to permit linking proprietary applications with
the library.  If this is what you want to do, use the GNU Lesser General
Public License instead of this License.  But first, please read
<https://www.gnu.org/licenses/why-not-lgpl.html>.
`,ee=()=>{const{t:a}=g(),[l,s]=d.useState([]),[i,h]=d.useState(!0);return d.useEffect(()=>{(async()=>{try{if(window.ipcRenderer){const o=await window.ipcRenderer.invoke("get-github-commits");o&&s(o)}}catch(o){console.error("Error fetching commits:",o)}finally{h(!1)}})()},[]),i?e.jsxs("div",{className:"about-commits-loading",children:[e.jsx("div",{className:"about-commits-spinner"}),e.jsx("span",{children:a("about.loadingCommits")})]}):l.length===0?e.jsx("div",{className:"about-commits-loading",children:e.jsx("span",{children:a("about.failedCommits")})}):e.jsx("div",{className:"about-commits-list",children:l.map(r=>e.jsxs("div",{className:"about-commit-item",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external",r.html_url)},children:[e.jsx("span",{className:"about-commit-msg",children:r.commit.message}),e.jsxs("div",{className:"about-commit-meta",children:[e.jsx("span",{className:"about-commit-hash",children:r.sha.substring(0,7)}),e.jsx("span",{children:"•"}),e.jsx("span",{children:new Date(r.commit.author.date).toLocaleDateString(void 0,{month:"short",day:"numeric",year:"numeric"})})]})]},r.sha))})},ae=({onClose:a})=>{const{t:l}=g();return d.useEffect(()=>{const s=i=>{i.key==="Escape"&&a()};return window.addEventListener("keydown",s),()=>window.removeEventListener("keydown",s)},[a]),e.jsx("div",{className:"about-modal-overlay",onClick:a,children:e.jsxs("div",{className:"about-modal-glass about-modal-glass--commits",onClick:s=>s.stopPropagation(),children:[e.jsxs("div",{className:"about-modal-scroll",children:[e.jsx("h2",{className:"about-modal-name",style:{marginBottom:"12px"},children:l("about.commitHistory")}),e.jsx(ee,{})]}),e.jsx("div",{className:"about-modal-close",onClick:a,children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e.jsx("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})})},ne=({onClose:a})=>{const{t:l}=g(),[s,i]=d.useState("1.0.0"),[h,r]=d.useState("");return d.useEffect(()=>{(async()=>{if(window.ipcRenderer){const n=await window.ipcRenderer.invoke("get-app-version");n&&typeof n=="object"?(i(n.version),n.buildVersion&&r(n.buildVersion)):typeof n=="string"&&i(n)}})();const c=n=>{n.key==="Escape"&&a()};return window.addEventListener("keydown",c),()=>window.removeEventListener("keydown",c)},[a]),e.jsx("div",{className:"about-modal-overlay",onClick:a,children:e.jsx("div",{className:"about-modal-glass",onClick:o=>o.stopPropagation(),children:e.jsxs("div",{className:"about-modal-scroll",children:[e.jsx("img",{src:H,alt:"Lune",className:"about-modal-logo"}),e.jsx("h2",{className:"about-modal-name",children:"Lune"}),e.jsx("p",{className:"about-modal-desc",children:l("about.description")}),e.jsxs("div",{className:"about-modal-links",children:[e.jsxs("button",{className:"about-modal-link-btn",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://github.com/saraansx/Lune-Music")},title:"GitHub",children:[e.jsx("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"})}),"GitHub"]}),e.jsxs("button",{className:"about-modal-link-btn about-modal-link-btn--discord",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://discord.gg/TardrVJT9N")},title:"Discord",children:[e.jsx("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"currentColor",children:e.jsx("path",{d:"M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"})}),"Discord"]})]}),e.jsx("div",{className:"about-modal-divider"}),e.jsxs("div",{className:"about-modal-meta",children:[e.jsx("span",{className:"about-meta-label",children:l("about.version")}),e.jsx("span",{className:"about-meta-value",children:s})]}),h&&e.jsxs("div",{className:"about-modal-meta",children:[e.jsx("span",{className:"about-meta-label",children:l("about.buildNumber")}),e.jsx("span",{className:"about-meta-value",children:h})]}),e.jsxs("div",{className:"about-modal-meta",children:[e.jsx("span",{className:"about-meta-label",children:l("about.license")}),e.jsx("span",{className:"about-meta-value about-meta-link",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://github.com/saraansx/Lune-Music?tab=GPL-3.0-1-ov-file")},children:"GPL-3.0"})]}),e.jsxs("div",{className:"about-modal-meta",children:[e.jsx("span",{className:"about-meta-label",children:l("about.repository")}),e.jsx("span",{className:"about-meta-value about-meta-link",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://github.com/saraansx/Lune-Music")},children:"github.com/saraansx/Lune-Music"})]}),e.jsxs("div",{className:"about-modal-meta",children:[e.jsx("span",{className:"about-meta-label",children:l("about.bugReports")}),e.jsx("span",{className:"about-meta-value about-meta-link about-meta-link--discord",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://discord.gg/CVQ4bxK7P6")},children:"Discord#bugs"})]}),e.jsx("div",{className:"about-modal-divider"}),e.jsxs("div",{className:"about-credits-card",children:[e.jsx("img",{src:_,alt:"Saraans",className:"about-credits-card-avatar"}),e.jsxs("div",{className:"about-credits-card-info",children:[e.jsx("span",{className:"about-credits-card-name",children:"Saraans"}),e.jsx("span",{className:"about-credits-card-desc",children:l("about.saraans.desc")})]}),e.jsxs("div",{className:"about-credits-card-socials",children:[e.jsx("button",{className:"about-credits-card-btn",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://github.com/saraansx")},title:"GitHub",children:e.jsx("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"})})}),e.jsx("button",{className:"about-credits-card-btn",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://x.com/saraansx")},title:"X",children:e.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"currentColor",children:e.jsx("path",{d:"M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"})})}),e.jsx("button",{className:"about-credits-card-btn",onClick:()=>{var o;return(o=window.ipcRenderer)==null?void 0:o.invoke("open-external","https://www.instagram.com/saraan._.s/")},title:"Instagram",children:e.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"2",y:"2",width:"20",height:"20",rx:"5",ry:"5"}),e.jsx("path",{d:"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"}),e.jsx("line",{x1:"17.5",y1:"6.5",x2:"17.51",y2:"6.5"})]})})]})]}),e.jsxs("div",{className:"about-license-section",children:[e.jsx("span",{className:"about-license-heading",children:l("about.licenseHeading")}),e.jsx("div",{className:"about-license-box",children:e.jsx("pre",{className:"about-license-text",children:X})})]}),e.jsxs("p",{className:"about-modal-footer",children:[l("about.footer")," ",e.jsx("span",{className:"about-footer-heart",children:"♥"})," ",l("about.footerSuffix")]})]})})})},oe=()=>{const{t:a}=g(),[l,s]=d.useState(!1),[i,h]=d.useState(!1);return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"settings-language-card about-lune-card",children:[e.jsxs("div",{className:"settings-account-header",children:[e.jsx("h2",{className:"settings-account-title",children:a("about.title")}),e.jsx("p",{className:"settings-account-description",children:a("about.sub")})]}),e.jsxs("div",{className:"language-content",children:[e.jsxs("div",{className:"settings-row about-nav-row",onClick:()=>s(!0),style:{cursor:"pointer"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("about.rowLabel")}),e.jsx("span",{className:"row-sub",children:a("about.rowSub")})]}),e.jsx("svg",{className:"about-chevron",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"9 18 15 12 9 6"})})]}),e.jsxs("div",{className:"settings-row about-nav-row",onClick:()=>h(!0),style:{cursor:"pointer"},children:[e.jsxs("div",{className:"row-info",children:[e.jsx("span",{className:"row-label",children:a("about.commitHistory")}),e.jsx("span",{className:"row-sub",children:a("about.commitsRowSub")})]}),e.jsx("svg",{className:"about-chevron",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("polyline",{points:"9 18 15 12 9 6"})})]})]})]}),l&&e.jsx(ne,{onClose:()=>s(!1)}),i&&e.jsx(ae,{onClose:()=>h(!1)})]})},ie=({accessToken:a,cookies:l})=>{const{t:s}=g();return e.jsx("div",{className:"settings-container",children:e.jsxs("div",{className:"settings-content",children:[e.jsx("div",{className:"settings-header",children:e.jsx("h1",{children:s("settings.settings")})}),e.jsx(F,{accessToken:a,cookies:l}),e.jsx(Y,{}),e.jsx(W,{}),e.jsx(z,{}),e.jsx(V,{}),e.jsx(q,{}),e.jsx(K,{}),e.jsx(Z,{}),e.jsx(J,{}),e.jsx(oe,{})]})})};export{ie as default};
