import { writeFileSync } from 'node:fs';
const poses = [
  [0,0,'open'],[0,0,'half'],[0,0,'closed'],[0,-1,'open'],[1,0,'open'],
  [-1,0,'open'],[-2,1,'open'],[-1,2,'hit'],[1,2,'half'],[0,2,'half'],
  [0,3,'closed'],[0,-3,'open'],[0,4,'closed'],[-1,4,'hit'],[0,6,'closed'],[0,7,'closed'],
];
const eye = (x, expression) => expression === 'closed' ? `<path d="M${x} 10h6v2h-6z" fill="#11170e"/>`
  : expression === 'hit' ? `<path d="M${x} 7h2v2h2v2h2v2h-2v-2h-2V9h-2zM${x+4} 7h2v2h-2v2h-2v2h-2v-2h2V9h2z" fill="#11170e"/>`
  : `<path d="M${x+2} 3h5v1h2v2h1v7h-1v2h-2v1h-5v-1h-2V5h2z" fill="#11170e"/>
<path d="M${x+2} 4h5v2h2v7h-2v2h-5v-2H${x+1}V6h1z" fill="#f5f0ce"/>
<path d="M${x+4} 6h3v2h1v4h-1v2h-3v-1h-1V8h1z" fill="#112a16"/>
<rect x="${x+4}" y="6" width="2" height="3" fill="#fffdf0"/>${expression === 'half' ? `<path d="M${x+1} 4h7v4h-7z" fill="#759735"/>` : ''}`;
const frames = poses.map(([dx,dy,expression], i) => `<g transform="translate(${i%4*192+44} ${Math.floor(i/4)*160+61})">
<path d="M9 22h13v2h4v10h-2v3h6v3H7v-2H4V28h2v-4h3z" fill="#151a0f"/>
<path d="M9 24h12v3h3v6h-3v4h-6v-3H7v-7h2z" fill="#666738"/><path d="M8 27h4v7h-5v-5h1zM15 25h4v11h-3z" fill="#939054"/>
<path d="M18 26h5v3h5v-2h3v5h-3v1h-8v-3h-2z" fill="#151a0f"/><path d="M20 27h2v3h6v-2h2v3h-9z" fill="#90b942"/>
<path d="M8 36h6v2h-7v-1h1zM20 37h7v1h-7z" fill="#899441"/><rect x="17" y="27" width="2" height="2" fill="#e4c36c"/>
<g transform="translate(${dx} ${dy})">
<path d="M3 9h4V4h4V1h8v3h5v3h5v5h3v6h-3v4h-6v2H10v-2H5v-3H2v-7h1z" fill="#11170e"/>
<path d="M5 10h4V5h3V3h6v3h5v3h4v5h3v3h-3v3h-5v2H11v-2H7v-3H4v-5h1z" fill="#90bb43"/>
<path d="M7 10h3V6h3V4h4v3h-4v4h-3v5H7zM20 9h6v5h-3v-2h-3z" fill="#b5d950"/>
<path d="M6 17h6v1h16v3h-5v2H11v-2H7v-2H6z" fill="#e4e49c"/>
${eye(9,expression)}${eye(20,expression)}
<path d="M10 17h2v2h5v1h7v-1h4v-2h2v3h-5v1h-9v-1h-5v-1h-1z" fill="#172514"/>
</g></g>`).join('\n');
writeFileSync(new URL('./pilot-frog.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="640" viewBox="0 0 768 640" shape-rendering="crispEdges">${frames}</svg>\n`);
